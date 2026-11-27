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
