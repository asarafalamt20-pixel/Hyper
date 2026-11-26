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
- SQLite persistence and image upload storage
- Basic rate limiting, Helmet headers and session cookies

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and change the secrets.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`

## Deploy on Render
1. Upload the contents of this folder to the root of a GitHub repository.
2. Create a Render Web Service from that repository, or use the included `render.yaml`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render environment variables.
4. Keep the persistent disk mounted at `/opt/render/project/src/data`.
5. Deploy. The app listens on Render's `PORT`.

## Important
This is a working starter, not a production-certified social network. Before opening it publicly, add email verification, password reset, stronger moderation workflows, backups, privacy/legal pages, abuse monitoring, and load testing. Do not use real user passwords from another service. Admin credentials must be unique and private.
