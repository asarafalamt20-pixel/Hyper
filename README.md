# HYPER – Social App Bundle

This ZIP bundles the current HYPER starter app and the features already present in this codebase:
- Home feed with photo/video posts, likes, comments, saves and sharing
- 24-hour grouped stories with story media controls and home-media pause/resume logic
- Shorts/Reels feed
- Profile page with edit name, bio, profile photo and cover photo
- Follow/follower lists and profile sharing
- Direct chat with media/document attachments and WebRTC call signaling
- Promote requests, admin featured placement, target reach, campaign duration and post ID selection
- Admin dashboard, moderation controls, storage listing/packs, and payment settings UI
- Admin can edit/remove PhonePe UPI ID and upload/replace/delete a PhonePe UPI QR image

## Payment limitation
PhonePe's payment gateway/API is **not connected** in this package. The current promotion request flow remains a demo/manual-review flow; it does not verify or collect a real payment. Do not treat screenshots as proof of payment. Any real payment setup must be created and operated by a parent/guardian through an authorised payment provider. Never store UPI PINs, OTPs, passwords or card PINs in this app.

## Not included / not claimed
This is not a literal merger of every app in the world. It does not include YouTube's platform, WhatsApp/Telegram network access, third-party account logins, full public livestream infrastructure, or their proprietary APIs. It is an independent HYPER app with selected social features. External integrations require each provider's official API approval and credentials.

## Run locally
1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Render deployment
- Upload the contents of this folder to the repository root.
- Node 22; build command `npm install`; start command `npm start`.
- Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (use a strong unique password) and `SESSION_SECRET` in Render Environment. Never share credentials in chat.
- Render Free uses temporary `/tmp/hyper-data`; uploaded media and JSON data may be lost after restarts/redeploys. Back up data before replacing an existing deployment.

## Testing
The ZIP archive integrity and `node --check server.js` are checked. A live Render deployment and real-device end-to-end test have not been performed.
