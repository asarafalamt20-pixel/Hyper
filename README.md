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


## Cloudflare R2 media storage (optional)

This build supports Cloudflare R2 for newly uploaded profile photos, posts, stories, story audio, and chat attachments. If R2 variables are not configured, uploads use the existing local upload folder. For R2, create a private R2 bucket and an API token with Object Read & Write permissions for that bucket. Enable a public custom domain for the bucket and set these Render environment variables:

- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 access key ID
- `R2_SECRET_ACCESS_KEY` — R2 secret access key (keep private; never put it in source code)
- `R2_BUCKET` — bucket name
- `R2_PUBLIC_URL` — public custom domain, for example `https://media.example.com` (no trailing slash)

Deploy after setting the variables. `/health` reports `mediaStorage: cloudflare-r2` when the configuration is complete. Existing local uploads are not migrated automatically; old records continue using `/uploads/...` URLs. Admin QR upload still uses the app's local upload folder.

**Important:** R2 stores media files only. The JSON database and login sessions still use `DATA_DIR`; Render Free local storage is temporary. Use a Render persistent disk or a managed database for durable accounts, posts, comments, earnings and payout history. Back up the current `data/hyper.json` before replacing/redeploying any project files.

## Creator earnings and withdrawals

Creator balances are credited manually by Admin only after checking actual, eligible net ad revenue from the ad network. The app does not pay a fixed amount per ordinary view and does not yet automatically import ad-network reports. Admin enters the verified share amount and settlement note in the Admin Dashboard. Users can request a withdrawal of at least ₹100 to a UPI ID or bank details. Admin must make the payment outside the app and then enter the UTR/reference to mark the request paid. Pending requests reserve the requested balance.

An approved ad-network account and its policy-compliant integration are still required before real ads can be served. Do not ask users to click ads or reward invalid/incentivized traffic.

## HYPER-wide 9 GB upload safety cap
- The server now checks the combined size of recorded post, story, story-audio, chat-attachment and profile-photo files before accepting a user upload.
- When recorded app media reaches 9 GiB, new user media uploads are rejected for everyone. Deleting a post removes its R2 object (when its URL is on the configured R2 public domain), reducing the tracked total so uploads can resume after space is freed.
- `/health` reports `appStorageBytes`, `appStorageLimitBytes` and `uploadsPaused` for basic diagnostics.
- This is an application-level tracked-size guard, not a live Cloudflare billing meter. It cannot enforce exact monthly Class A/B request quotas or guarantee a $0 bill. Cloudflare usage/billing must still be checked in the Cloudflare dashboard. Reads served through a public domain/CDN, direct bucket access, admin QR uploads, orphaned objects and any uploads not represented in the app database may not be reflected in the app counter.
- Before deploying, back up the existing `hyper.json`. Test R2 uploads and post deletion with a small test file first. Do not rely on the 9 GiB guard as a billing guarantee.
