const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "asarafalamt20@gmail.com").trim().toLowerCase();

app.use(express.json());
app.use(express.static(__dirname));

let pool = null;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  });
}

async function initDatabase() {
  if (!pool) {
    console.error("DATABASE_URL is missing");
    return false;
  }
  try {
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Safe migration for an older Hyper database.
    // CREATE TABLE IF NOT EXISTS does not modify an existing table, so an
    // older users table may be missing the newer `name` column.
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);

    // Normalize legacy columns. Older Hyper databases can have `name` and
    // `username` with different PostgreSQL types. Using the same SQL parameter
    // for both columns then causes:
    //   inconsistent types deduced for parameter $3
    // Convert both identity columns to TEXT before registration.
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN name TYPE TEXT USING name::text
    `);
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN username TYPE TEXT USING username::text
    `);

    // Keep compatibility with older Hyper databases that use a required
    // `username` column while the current app uses `name`.
    await pool.query(`
      UPDATE users
      SET name = COALESCE(NULLIF(name, ''), NULLIF(username, ''), split_part(email, '@', 1))
      WHERE name IS NULL OR name = ''
    `);
    await pool.query(`
      UPDATE users
      SET username = COALESCE(NULLIF(username, ''), NULLIF(name, ''), split_part(email, '@', 1))
      WHERE username IS NULL OR username = ''
    `);
    await pool.query(`ALTER TABLE users ALTER COLUMN name SET NOT NULL`);
    await pool.query(`ALTER TABLE users ALTER COLUMN username SET NOT NULL`);
    await pool.query(`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW()`);

    console.log("Database connected and users table/migrations ready");
    return true;
  } catch (err) {
    console.error("DATABASE_ERROR:", err.message);
    return false;
  }
}

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired" });
  }
}

app.get("/health", async (req, res) => {
  let database = false;
  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = true;
    } catch {}
  }
  res.json({ ok: true, app: "Hyper", database, adminConfigured: !!JWT_SECRET });
});

app.post("/api/register", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Database is not connected. Add DATABASE_URL in Render." });
    }
    if (!JWT_SECRET) {
      return res.status(503).json({ error: "JWT_SECRET is not configured in Render." });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "Enter a valid email." });
    if (name.length < 2)
      return res.status(400).json({ error: "Name must be at least 2 characters." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, name, username) VALUES ($1,$2,$3,$4) RETURNING id,email,name,username",
      [email, hash, name, name]
    );

    const user = result.rows[0];
    res.json({
      token: makeToken(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.email === ADMIN_EMAIL
      }
    });
  } catch (err) {
    console.error("REGISTER_ERROR:", err.message);
    if (err.code === "23505")
      return res.status(409).json({ error: "This email is already registered. Use Login." });
    return res.status(500).json({ error: "Registration failed. Check Render database connection." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    if (!pool)
      return res.status(503).json({ error: "Database is not connected. Add DATABASE_URL in Render." });
    if (!JWT_SECRET)
      return res.status(503).json({ error: "JWT_SECRET is not configured in Render." });

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const result = await pool.query(
      "SELECT id,email,password_hash,name FROM users WHERE email=$1",
      [email]
    );
    if (!result.rowCount)
      return res.status(401).json({ error: "Invalid email or password." });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok)
      return res.status(401).json({ error: "Invalid email or password." });

    res.json({
      token: makeToken(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.email === ADMIN_EMAIL
      }
    });
  } catch (err) {
    console.error("LOGIN_ERROR:", err.message);
    return res.status(500).json({ error: "Login failed. Check Render database connection." });
  }
});

app.get("/api/me", auth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      isAdmin: req.user.email === ADMIN_EMAIL
    }
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function start() {
  if (!JWT_SECRET) console.warn("WARNING: JWT_SECRET is not configured.");
  await initDatabase();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hyper listening on port ${PORT}`);
  });
}
start();
