const express = require("express");
const session = require("express-session");
const SQLiteStore = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new SQLiteStore(path.join(DATA_DIR, "hyper.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL, bio TEXT DEFAULT '', avatar TEXT DEFAULT '', is_admin INTEGER DEFAULT 0,
 is_suspended INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, caption TEXT DEFAULT '',
 image TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS likes (
 user_id INTEGER NOT NULL, post_id INTEGER NOT NULL, PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, post_id INTEGER NOT NULL,
 body TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS follows (
 follower_id INTEGER NOT NULL, following_id INTEGER NOT NULL,
 PRIMARY KEY(follower_id,following_id)
);
CREATE TABLE IF NOT EXISTS stories (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, body TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blocks (
 blocker_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, PRIMARY KEY(blocker_id,blocked_id)
);
CREATE TABLE IF NOT EXISTS reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL, target_type TEXT NOT NULL,
 target_id INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT DEFAULT 'open',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);
const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const adminPassword = process.env.ADMIN_PASSWORD || "";
if (adminEmail && adminPassword) {
  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if (!existing) db.prepare("INSERT INTO users(name,email,password,is_admin) VALUES(?,?,?,1)")
    .run("Hyper Admin", adminEmail, bcrypt.hashSync(adminPassword, 12));
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
 secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
 resave: false, saveUninitialized: false,
 cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7*24*60*60*1000 }
}));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1d" }));
app.use(rateLimit({ windowMs: 15*60*1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

const storage = multer.diskStorage({
 destination: (_,__,cb) => cb(null, UPLOAD_DIR),
 filename: (_,file,cb) => cb(null, Date.now()+"-"+Math.random().toString(36).slice(2,10)+path.extname(file.originalname).toLowerCase())
});
const upload = multer({
 storage, limits: { fileSize: 5*1024*1024 },
 fileFilter: (_,file,cb) => cb(null, /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype))
});
const safeUser = u => ({ id:u.id, name:u.name, email:u.email, bio:u.bio, avatar:u.avatar, is_admin:!!u.is_admin });
const current = req => req.session.userId ? db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId) : null;
const auth = (req,res,next) => { const u=current(req); if(!u) return res.status(401).json({error:"Please log in"}); if(u.is_suspended) return res.status(403).json({error:"Account suspended"}); req.user=u; next(); };
const admin = (req,res,next) => { if(!req.user?.is_admin) return res.status(403).json({error:"Admin only"}); next(); };
const blockedEither = (a,b) => !!db.prepare("SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)").get(a,b,b,a);

app.get("/health", (_,res)=>res.json({ok:true,app:"Hyper Instagram"}));
app.get("/api/me", (req,res)=>{ const u=current(req); res.json({user:u?safeUser(u):null}); });

app.post("/api/register", rateLimit({windowMs:60*60*1000,limit:12}), async (req,res)=>{
 const name=String(req.body.name||"").trim().slice(0,40), email=String(req.body.email||"").trim().toLowerCase(), password=String(req.body.password||"");
 if(name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<10) return res.status(400).json({error:"Enter a name, valid email and password (at least 10 characters)."});
 if(db.prepare("SELECT id FROM users WHERE email=?").get(email)) return res.status(409).json({error:"Email already registered"});
 const hash=await bcrypt.hash(password,12);
 const info=db.prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)").run(name,email,hash);
 req.session.userId=info.lastInsertRowid; res.json({user:safeUser(current(req))});
});
app.post("/api/login", rateLimit({windowMs:15*60*1000,limit:10}), async (req,res)=>{
 const email=String(req.body.email||"").trim().toLowerCase(), password=String(req.body.password||"");
 const u=db.prepare("SELECT * FROM users WHERE email=?").get(email);
 if(!u || !(await bcrypt.compare(password,u.password))) return res.status(401).json({error:"Incorrect email or password"});
 if(u.is_suspended) return res.status(403).json({error:"Account suspended"});
 req.session.userId=u.id; res.json({user:safeUser(u)});
});
app.post("/api/logout",auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/feed", (req,res)=>{
 const me=current(req), id=me?.id||0;
 const rows=db.prepare(`SELECT p.*,u.name,u.avatar,
 (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) likes,
 (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments,
 EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked
 FROM posts p JOIN users u ON u.id=p.user_id
 WHERE u.is_suspended=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))
 ORDER BY p.id DESC LIMIT 100`).all(id,id,id);
 res.json({posts:rows});
});
app.post("/api/posts",auth,upload.single("image"),(req,res)=>{
 const caption=String(req.body.caption||"").trim().slice(0,1500), image=req.file?"/uploads/"+req.file.filename:"";
 if(!caption && !image) return res.status(400).json({error:"Add a caption or image"});
 const info=db.prepare("INSERT INTO posts(user_id,caption,image) VALUES(?,?,?)").run(req.user.id,caption,image);
 res.json({id:info.lastInsertRowid});
});
app.post("/api/posts/:id/like",auth,(req,res)=>{
 const id=Number(req.params.id), p=db.prepare("SELECT user_id FROM posts WHERE id=?").get(id);
 if(!p || blockedEither(req.user.id,p.user_id)) return res.status(404).json({error:"Post not found"});
 const exists=db.prepare("SELECT 1 FROM likes WHERE user_id=? AND post_id=?").get(req.user.id,id);
 exists?db.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").run(req.user.id,id):db.prepare("INSERT OR IGNORE INTO likes(user_id,post_id) VALUES(?,?)").run(req.user.id,id);
 res.json({liked:!exists});
});
app.get("/api/posts/:id/comments",(req,res)=>{
 const id=Number(req.params.id);
 res.json({comments:db.prepare("SELECT c.id,c.body,c.created_at,u.id user_id,u.name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC LIMIT 100").all(id)});
});
app.post("/api/posts/:id/comments",auth,(req,res)=>{
 const body=String(req.body.body||"").trim().slice(0,500), id=Number(req.params.id);
 const p=db.prepare("SELECT user_id FROM posts WHERE id=?").get(id);
 if(!body || !p || blockedEither(req.user.id,p.user_id)) return res.status(400).json({error:"Cannot add comment"});
 db.prepare("INSERT INTO comments(user_id,post_id,body) VALUES(?,?,?)").run(req.user.id,id,body);
 res.json({ok:true});
});
app.delete("/api/posts/:id",auth,(req,res)=>{
 const id=Number(req.params.id), p=db.prepare("SELECT * FROM posts WHERE id=?").get(id);
 if(!p) return res.status(404).json({error:"Post not found"});
 if(p.user_id!==req.user.id && !req.user.is_admin) return res.status(403).json({error:"Not allowed"});
 db.prepare("DELETE FROM posts WHERE id=?").run(id); db.prepare("DELETE FROM likes WHERE post_id=?").run(id); db.prepare("DELETE FROM comments WHERE post_id=?").run(id);
 res.json({ok:true});
});
app.get("/api/users/search",(req,res)=>{
 const q="%"+String(req.query.q||"").trim().slice(0,40)+"%";
 const me=current(req);
 const users=db.prepare("SELECT id,name,bio,avatar FROM users WHERE name LIKE ? AND is_suspended=0 ORDER BY name LIMIT 30").all(q)
 .filter(u=>!me || !blockedEither(me.id,u.id));
 res.json({users});
});
app.get("/api/users/:id",(req,res)=>{
 const id=Number(req.params.id), me=current(req), u=db.prepare("SELECT id,name,bio,avatar,created_at FROM users WHERE id=? AND is_suspended=0").get(id);
 if(!u || (me && blockedEither(me.id,id))) return res.status(404).json({error:"User not found"});
 res.json({user:u,followers:db.prepare("SELECT COUNT(*) n FROM follows WHERE following_id=?").get(id).n,
 following:db.prepare("SELECT COUNT(*) n FROM follows WHERE follower_id=?").get(id).n,
 posts:db.prepare("SELECT p.id,p.caption,p.image,p.created_at,(SELECT COUNT(*) FROM likes WHERE post_id=p.id) likes FROM posts p WHERE p.user_id=? ORDER BY p.id DESC").all(id),
 followingMe:me?!!db.prepare("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?").get(me.id,id):false,
 isMe:!!me&&me.id===id});
});
app.put("/api/profile",auth,upload.single("avatar"),(req,res)=>{
 const name=String(req.body.name||req.user.name).trim().slice(0,40), bio=String(req.body.bio||"").trim().slice(0,240);
 const avatar=req.file?"/uploads/"+req.file.filename:req.user.avatar;
 if(name.length<2) return res.status(400).json({error:"Name is too short"});
 db.prepare("UPDATE users SET name=?,bio=?,avatar=? WHERE id=?").run(name,bio,avatar,req.user.id);
 res.json({user:safeUser(current(req))});
});
app.post("/api/users/:id/follow",auth,(req,res)=>{
 const id=Number(req.params.id); if(id===req.user.id || !db.prepare("SELECT id FROM users WHERE id=? AND is_suspended=0").get(id) || blockedEither(req.user.id,id)) return res.status(400).json({error:"Cannot follow this account"});
 const has=db.prepare("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?").get(req.user.id,id);
 has?db.prepare("DELETE FROM follows WHERE follower_id=? AND following_id=?").run(req.user.id,id):db.prepare("INSERT OR IGNORE INTO follows VALUES(?,?)").run(req.user.id,id);
 res.json({following:!has});
});
app.post("/api/users/:id/block",auth,(req,res)=>{
 const id=Number(req.params.id); if(id===req.user.id) return res.status(400).json({error:"Cannot block yourself"});
 const has=db.prepare("SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?").get(req.user.id,id);
 if(has) db.prepare("DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?").run(req.user.id,id);
 else { db.prepare("INSERT OR IGNORE INTO blocks VALUES(?,?)").run(req.user.id,id); db.prepare("DELETE FROM follows WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)").run(req.user.id,id,id,req.user.id); }
 res.json({blocked:!has});
});
app.post("/api/stories",auth,(req,res)=>{
 const body=String(req.body.body||"").trim().slice(0,180);
 if(!body) return res.status(400).json({error:"Write a short story"});
 db.prepare("INSERT INTO stories(user_id,body,expires_at) VALUES(?,?,datetime('now','+24 hours'))").run(req.user.id,body);
 res.json({ok:true});
});
app.get("/api/stories",(req,res)=>{
 db.prepare("DELETE FROM stories WHERE expires_at<=datetime('now')").run();
 res.json({stories:db.prepare("SELECT s.id,s.body,s.created_at,u.id user_id,u.name,u.avatar FROM stories s JOIN users u ON u.id=s.user_id WHERE u.is_suspended=0 ORDER BY s.id DESC LIMIT 50").all()});
});
app.post("/api/report",auth,(req,res)=>{
 const type=String(req.body.type||""), id=Number(req.body.id), reason=String(req.body.reason||"").trim().slice(0,300);
 if(!["post","user"].includes(type)||!id||reason.length<4) return res.status(400).json({error:"Choose a reason"});
 db.prepare("INSERT INTO reports(reporter_id,target_type,target_id,reason) VALUES(?,?,?,?)").run(req.user.id,type,id,reason);
 res.json({ok:true});
});
app.get("/api/admin/overview",auth,admin,(req,res)=>{
 res.json({
 stats:{users:db.prepare("SELECT COUNT(*) n FROM users").get().n,posts:db.prepare("SELECT COUNT(*) n FROM posts").get().n,reports:db.prepare("SELECT COUNT(*) n FROM reports WHERE status='open'").get().n},
 reports:db.prepare("SELECT r.*,u.name reporter FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.id DESC LIMIT 100").all(),
 users:db.prepare("SELECT id,name,email,is_suspended,created_at FROM users ORDER BY id DESC LIMIT 100").all()
 });
});
app.post("/api/admin/reports/:id/close",auth,admin,(req,res)=>{
 db.prepare("UPDATE reports SET status='closed' WHERE id=?").run(Number(req.params.id)); res.json({ok:true});
});
app.post("/api/admin/users/:id/suspend",auth,admin,(req,res)=>{
 const id=Number(req.params.id); if(id===req.user.id) return res.status(400).json({error:"Cannot suspend yourself"});
 db.prepare("UPDATE users SET is_suspended=1-is_suspended WHERE id=? AND is_admin=0").run(id); res.json({ok:true});
});

app.get("/",(_,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.get("*",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,()=>console.log("Hyper Instagram listening on "+PORT));
