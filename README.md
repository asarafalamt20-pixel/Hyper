# Hyper Instagram

A single-root-folder social photo-sharing web app starter for Render.

## Features
- Register, login and logout with hashed passwords
- Profile page and profile editing
- Create text/image posts, feed, likes and comments
- Follow/unfollow users and search users
- Text stories with 24-hour expiry
- Report posts and users; block/unblock accounts
- Admin dashboard to review reports, remove posts and suspend accounts
- SQLite persistence and persistent image upload storage (inside the mounted data disk)
- Basic rate limiting, Helmet headers and session cookies

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and change the secrets.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`

## Runtime compatibility

This project is pinned to Node.js 22 LTS because `better-sqlite3` uses a native prebuilt binary. The `.node-version`, `package.json` engine, and `render.yaml` all select Node 22. If you already created a Render service, set its `NODE_VERSION` environment variable to `22.16.0`, then run **Clear build cache & deploy**.

## Deploy on Render
1. Upload the contents of this folder to the root of a GitHub repository.
2. Create a Render Web Service from that repository, or use the included `render.yaml`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render environment variables.
4. Keep the persistent disk mounted at `/opt/render/project/src/data`. The database and uploaded profile/post images are stored on this disk so they survive deploys.
5. Deploy. The app listens on Render's `PORT`.

## Important
This is a working starter, not a production-certified social network. Before opening it publicly, add email verification, password reset, stronger moderation workflows, backups, privacy/legal pages, abuse monitoring, and load testing. Do not use real user passwords from another service. Admin credentials must be unique and private.


## Profile save troubleshooting
- Profile updates now return a clear error message for invalid image types, files larger than 8 MB, and server failures.
- Uploaded images are stored inside the persistent `data/uploads` directory.
- After updating the GitHub repository, use Render **Manual Deploy → Clear build cache & deploy**.
