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
- This package is configured for Render Free and does not request a paid Persistent Disk. It uses writable temporary storage at `/tmp/hyper-data` so the server can start without the `/var/data` permission error.
- The app stores its JSON database, uploaded files, and session files in `/tmp/hyper-data` on the free instance.
- Set `ADMIN_EMAIL` to your administrator email and `ADMIN_PASSWORD` to a new password of at least 6 characters (a longer, unique password is safer) in Render → Environment. Do not put the password in source code or GitHub. The app creates/promotes this admin account at startup; log in through the normal Login button, then open Admin.
- Keep the persistent disk attached when deploying new versions.

## Upload and media behavior
- Photo/video posts and story attachments are saved under the configured upload directory. On Render Free this is temporary storage.
- Select **Short video (Reels)** when creating a short; ordinary video posts appear in Videos, while Shorts appear in the Shorts tab.
- Upload limit is 100 MB per file. Allowed formats are common JPG/PNG/GIF/WEBP, MP4/WEBM/MOV and common office/PDF/text/ZIP documents.
- The Storage page lists the signed-in user's uploaded post/story files and sent/received chat attachments. It reports actual recorded file sizes; the 500 MB figure is a display quota, not strict per-account enforcement.

## Free plan storage warning
Render Free has no persistent disk. This build falls back to `/tmp/hyper-data` and should boot without buying a disk, but uploaded files and the JSON database are temporary and are not guaranteed to survive restarts or redeploys. For durable cloud persistence, connect an external database and object-storage provider; that requires creating provider credentials and configuring them as environment variables.

## Important limitations
- This is an MVP starter, not a fully audited production social network. The JSON database is intended for a small single-instance deployment; use a real database and object storage before scaling.
- Audio/video calls require HTTPS and microphone/camera permission. Calls use public STUN servers; some mobile networks require a TURN relay service for reliable connectivity. Both users generally need to be online in the site.
- File uploads are limited by the service's available disk space. Back up the persistent disk.
- Add stronger moderation, abuse review, privacy/legal pages, backups, and operational monitoring before a public launch.


## Admin setup and data persistence
In Render → Environment, set `ADMIN_EMAIL` to your existing account email and `ADMIN_PASSWORD` to a NEW strong password of at least 12 characters. The admin role is assigned at server startup; redeploy after saving the variables, then sign out and sign back in. Never put the password in source code or share it in chat. The Render Free blueprint uses `/tmp/hyper-data` to avoid paid disk requirements and permission errors. Posts and media remain available across logout/login while the instance storage remains intact, but Render Free may erase temporary files during restarts, redeploys, or instance replacement. This package does not yet provide durable external cloud database/object storage. Sessions last up to 30 days unless you log out or clear browser cookies.

This update adds owner/admin post deletion, post/reel sharing into chat, optional audio tracks on stories, muted autoplay when videos enter the viewport, and like-button updates without reloading the feed video. Autoplay is muted because browsers block automatic sound.

## Storage packs (added)
- Every user starts with 500 MB free quota. Approved purchases add permanent storage on top of that quota.
- Default packs: 50 MB ₹5, 100 MB ₹10, 250 MB ₹20, 500 MB ₹39, 1 GB ₹69, 2 GB ₹129, 5 GB ₹299.
- Users submit a UPI/bank payment reference from the Storage page. Admin must verify the payment in the bank/UPI account before approving; approval adds the pack bytes to that user's account.
- Admin can change pack labels, sizes, prices, and active status from Admin Dashboard → Storage Pack Settings.
- Upload routes enforce each user's quota. If the limit is reached, the upload is rejected with a message to buy storage or remove old uploads.

IMPORTANT STORAGE DEPLOYMENT NOTE:
This package adds quota accounting and purchase approval, but its existing media engine still writes uploads to the app's local DATA_DIR. It is NOT yet connected to Cloudflare R2. Render Free local storage is ephemeral and must not be treated as durable storage. To use R2, configure an R2 bucket and credentials and integrate the R2 object client before relying on paid storage packs. Do not promise permanent media retention until R2 (or another persistent object store) is connected and tested. Back up the existing database before deploying this update.
