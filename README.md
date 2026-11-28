# HYPER Social App

A public-first social website with a public home feed, photo/video posts, a separate Shorts feed, optional login, profile editing, likes/comments, 24-hour photo/video stories, people search, direct messages with image/video/document attachments, a storage listing, and WebRTC audio/video call signaling.

## Run locally
1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Deploy on Render
- Upload the **contents** of this folder to the GitHub repository root.
- Use Node `22.16.0`, build command `npm install`, start command `npm start`.
- The included `render.yaml` requests a 1 GB persistent disk mounted at `/var/data`; persistent disks require a paid Render service.
- Set `DATA_DIR=/var/data`. The app stores its JSON database, uploaded files, and session files on this disk.
- Set `ADMIN_EMAIL` to your administrator email and `ADMIN_PASSWORD` to a new strong password of at least 12 characters in Render → Environment. Do not put the password in source code or GitHub. The app creates/promotes this admin account at startup; log in through the normal Login button, then open Admin.
- Keep the persistent disk attached when deploying new versions.

## Upload and media behavior
- Photo/video posts and story attachments are saved under the persistent upload directory.
- Select **Short video (Reels)** when creating a short; ordinary video posts appear in Videos, while Shorts appear in the Shorts tab.
- Upload limit is 100 MB per file. Allowed formats are common JPG/PNG/GIF/WEBP, MP4/WEBM/MOV and common office/PDF/text/ZIP documents.
- The Storage page lists the signed-in user's uploaded post/story files and sent/received chat attachments. It reports actual recorded file sizes; the 500 MB figure is a display quota, not strict per-account enforcement.

## Important limitations
- This is an MVP starter, not a fully audited production social network. The JSON database is intended for a small single-instance deployment; use a real database and object storage before scaling.
- Audio/video calls require HTTPS and microphone/camera permission. Calls use public STUN servers; some mobile networks require a TURN relay service for reliable connectivity. Both users generally need to be online in the site.
- File uploads are limited by the service's available disk space. Back up the persistent disk.
- Add stronger moderation, abuse review, privacy/legal pages, backups, and operational monitoring before a public launch.


## Admin setup and data persistence
In Render → Environment, set `ADMIN_EMAIL` to your existing account email and `ADMIN_PASSWORD` to a NEW strong password of at least 12 characters. The admin role is assigned at server startup; redeploy after saving the variables, then sign out and sign back in. Never put the password in source code or share it in chat. The Render blueprint mounts a persistent disk at `/var/data`, so posts, reels, uploaded media and sessions survive deploys/restarts on a paid Render disk. Sessions last up to 30 days unless you log out or clear browser cookies.

This update adds owner/admin post deletion, post/reel sharing into chat, optional audio tracks on stories, muted autoplay when videos enter the viewport, and like-button updates without reloading the feed video. Autoplay is muted because browsers block automatic sound.
