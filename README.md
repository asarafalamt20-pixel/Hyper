# HYPER Social App

HYPER is an all-in-one social community starter: Facebook-style home feed and groups, Instagram-style stories and Reels, WhatsApp-style private chat, and YouTube-style video posts embedded in the Home feed. It includes profiles, likes/comments, people search, file uploads, an admin dashboard, and WebRTC audio/video call signaling. It does not connect to or import accounts/data from those third-party services.

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
- Create image or video posts in the Home feed. Short-form posts are shown under Reels; there is no separate Videos tab.
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

This build keeps video posts inside the Home feed, uses Reels for short-form posts, and removes the separate Videos tab. Story audio/video playback and chat sharing are included. Promotion requests are demo-only and do not process payments.

## Storage
- The Storage page displays the signed-in user's uploaded files and current usage.
- No live payment gateway, UPI collection, bank-detail collection, paid storage purchase, or creator payout is enabled in this build.

## Media storage note

This build stores uploaded media on the Node server's local `DATA_DIR/uploads` folder. Cloudflare R2 integration and R2 environment variables have been removed. A Render Free filesystem is temporary and can be cleared on restart/redeploy; use a persistent disk or a separately hosted storage server for durable media. A phone's internal storage cannot be used by this hosted website merely by plugging in a biometric OTG adapter: a separate Android companion server app plus a secure, reachable connection would be required. This ZIP does not include that Android APK or claim to provide unlimited cloud storage.

## HYPER social layout
- Story groups now try to start video/audio immediately after the user opens a story group, stop the previous story's media, and advance automatically when media ends or its fallback display timer completes. Browser autoplay policies can still require a tap.
- Profile avatars are clickable and open the corresponding user profile; profile pages show follower/following counts and separate Posts and Reels tabs.
- Admin can feature a post or Reel at the top of Home for 1–365 days, set ordering priority, and stop a campaign. Featured items are labelled Sponsored. Reach targets are goals, not guaranteed or artificially purchased views.
- Multiple-account email switching from the prior package remains available on the same device.

Before deployment, back up the existing database and uploads. Render Free storage is temporary.


## Payment safety
This ZIP is a demonstration social app. Promotion requests are test-only; it does not accept UPI, PhonePe, QR, bank-account details, or process real payments/payouts. A real payment integration must be arranged by an adult account holder with an authorized payment provider and appropriate legal/compliance review.

## Online videos in Home
- Admin can add public YouTube, Vimeo, and Dailymotion video links from Admin Dashboard → Add online video to Home.
- Supported links are embedded in the Home feed. Other websites may block embedding; those links open on their source website.
- The app does not scrape or automatically import every video from the internet. An Admin must add the public video links.
- Home → Videos filter includes uploaded videos and Admin-added online videos.
- User-facing Promote navigation/payment request flow is removed. Admin-sponsored placement controls remain in Admin Dashboard.
