# HYPER Social App

Public-first social site: public home feed, photos/videos, short-video feed, account registration/login with show/hide password, profile editing, likes/comments, follows/search, private chat with photo/video/document attachments, WebRTC audio/video call signaling, and a storage listing.

## Local run
1. Install Node.js 22 LTS.
2. Run `npm install`
3. Run `npm start`
4. Open `http://localhost:3000`

## Render deployment
- Upload the contents of the `Hyper-Instagram` folder to the GitHub repository root.
- Use Node 22.16.0, build command `npm install`, start command `npm start`.
- Add a persistent disk mounted at `/var/data` (the included `render.yaml` requests a 1 GB disk on a paid Render plan).
- Set `DATA_DIR=/var/data` and a strong `SESSION_SECRET`.
- The JSON database and uploaded files are stored under DATA_DIR. Keep the disk attached when redeploying.

## Important limits
- This is an MVP starter, not a fully audited production social network. Add moderation, backups, privacy/legal pages, abuse reporting workflows and stronger operational monitoring before public launch.
- WebRTC calls use public STUN servers. Some mobile networks/firewalls require a TURN relay server for reliable calls; set up a TURN provider for production-grade calling.
- Browser calls require HTTPS and microphone/camera permission. Calls work best while both users are online in the site.
- Storage page lists files uploaded by the signed-in user. The configured 500 MB quota is a display limit in this starter, not hard per-user enforcement.
- Session storage is in-memory; users may need to log in again after a server restart. Use a persistent session store for production.
