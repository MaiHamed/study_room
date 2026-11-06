# Studyroom

Studyroom is a local-first study app built with plain HTML, CSS, and JavaScript. The browser's `localStorage` at `studyroom.v1` remains the working copy, so studying and backups work without an account or network. Signing in enables optional MongoDB Atlas sync between devices.

## Architecture

```text
frontend/                 Static app (no framework, build step, or frontend packages)
  public/index.html       Public landing page and account entry points
  public/app.html          Existing Studyroom application
  src/js/                 Existing app, local storage, backup, admin, and cloud sync modules
backend/src/
  app.js                  Express app shared by local and serverless entry points
  server.js               Local development listener only
  routes/                 HTTP routes
  controllers/            Request/response handling
  services/               Business logic and MongoDB queries
  middleware/             Authentication, admin checks, rate limits, validation, errors
  validators/             Request shape and size validation
  config/                 Environment and reusable MongoDB connection
api/index.js              One Vercel Function that exports the Express app
```

MongoDB Atlas was selected because its document model maps naturally to the app's nested question and exam snapshots while providing a managed cloud database. The backend uses MongoDB's official Node.js driver. Synced documents retain app IDs in `clientId`; Mongo `_id` values remain server-owned. Every user-owned content record is scoped by the authenticated `ownerId`; clients cannot supply ownership. `importHashes` uses a compound owner/hash unique index so each user's import hash is an idempotency key. Questions accept `mcq`, `tf`, and the app's existing `short` answer type; synced subjects also retain topic descriptions and questions retain import notes.

| Collection | Document contents |
| --- | --- |
| `users` | Normalized unique email, bcrypt hash, profile/settings, role, disabled flag, clear marker, timestamps, and last activity. Hashes never leave the API. |
| `subjects` | Owner, name, topics, aliases, topic descriptions, timestamps, tombstone. |
| `questions` | Owner, subject/topic IDs, type, prompt, choices/answer/explanation, import notes, timestamps, tombstone. Empty subject IDs are stored as `null`. |
| `cards` | Owner, front/back, subject/topic/source IDs, due date, interval, rating, revision flag, timestamps, tombstone. |
| `exams` | Owner, exam definition snapshot, timestamps, tombstone. |
| `attempts` | Owner, exam reference and full question/answer/score snapshot, timestamps, tombstone. |
| `reviews` | Owner, question ID, right/wrong counts and review flags, timestamps, tombstone. |
| `importHashes` | Owner, hash as client key, timestamps, tombstone; unique per owner for safe retry. |
| `activityLog` | Append-only owner/system events, resource details, metadata capped at 16 KB, creation timestamp. |

Sync pushes validated batches in MongoDB transactions, assigns cloud timestamps on the server, and returns a conflict when a record's base version is stale. Pulls use an `updatedAt` cursor with a small overlap and `(updatedAt, clientId)` keyset ordering; tombstones stay in the cloud so deletes propagate. Clear data hard-deletes the user's synced study records, preserves the account and audit log, and advances `users.clearedAt`; a signed-in browser wipes its local study copy when it sees a newer value. Local profile photos remain in that browser and are not uploaded.

## Run locally

Requirements: Node.js 20 or newer, npm, and a MongoDB Atlas database (or a local MongoDB replica set for transaction support).

1. Create a database and database user in Atlas (see setup below).
2. Copy `.env.example` to `.env` and fill in the values.
3. Install backend packages and start the API:

   ```sh
   npm install
   npm run dev
   ```

4. Serve `frontend/` with any static server. For example, `npx serve frontend -l 5500`. Localhost frontends on any port are accepted in development. Set `FRONTEND_URL` to the frontend origin and `FRONTEND_APP_URL` to its `/public/app.html` URL for OAuth redirects.
5. Open `http://localhost:5500/public/index.html` for the public homepage. Use **Get started** or **Log in** to open the account dialog. Successful sign-in opens `http://localhost:5500/public/app.html`. The local API base automatically targets `http://localhost:3000` on localhost.

The API health check is `GET http://localhost:3000/api/health`. Password reset email requires `RESEND_API_KEY` and `MAIL_FROM`; without them, requests still return a generic success, but no reset email can be delivered.

## Create an Atlas M0 database

1. Create an account at [MongoDB Atlas](https://www.mongodb.com/atlas/database), create a project, then choose **Build a Database** and a **Free (M0)** cluster. Pick a region close to your Vercel deployment.
2. In **Database Access**, create a database user with a strong, unique password. Use the least privilege needed for the Studyroom database; do not reuse your Atlas account password.
3. In **Network Access**, allow your development IP address. For deployed functions, choose an access strategy appropriate to your Atlas/Vercel plans. Avoid `0.0.0.0/0` unless you knowingly accept public network reachability; authentication is still required, but an IP restriction is an extra boundary.
4. In the cluster's **Connect** flow choose **Drivers**, select Node.js, and copy the connection URI. Replace the password placeholder and add the database name, for example `...mongodb.net/studyroom?retryWrites=true&w=majority`.
5. Put the URI in `.env` as `MONGODB_URI`. Never put it in frontend JavaScript or commit it.

Atlas Free clusters currently provide 0.5 GB storage and have operational limits; check MongoDB's [current M0 limitations](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) before relying on the free tier. Keep backups and monitor usage. Study content and retained tombstones both use this storage.

## Environment variables

Required in production:

```env
MONGODB_URI=mongodb+srv://<database-user>:<password>@<cluster-host>/studyroom?retryWrites=true&w=majority
MONGODB_DB_NAME=studyroom
JWT_SECRET=<at-least-32-random-characters>
FRONTEND_URL=https://your-studyroom-domain.example
FRONTEND_APP_URL=https://your-studyroom-domain.example/public/app.html
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-studyroom-domain.example/api/auth/google/callback
```

`FRONTEND_URL` can contain comma-separated allowed origins when the frontend is hosted at more than one origin. `FRONTEND_APP_URL` is the app page used after Google sign-in. `COOKIE_SAME_SITE` defaults to `lax`; use `none` only when frontend and API are cross-site and set `secure` through HTTPS production. Password reset email optionally uses `RESEND_API_KEY` and `MAIL_FROM`. See `.env.example` for all supported settings.

### Configure Google sign-in

Google sign-in uses a backend authorization-code flow with state and PKCE checks. The server verifies the Google ID-token signature, issuer, audience, expiry, nonce, and verified email before linking or creating an account. A matching email on an existing password account must sign in first and link Google from **Account**; the OAuth flow binds the link to that authenticated account. See Google's [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) and [OpenID Connect validation requirements](https://developers.google.com/identity/openid-connect/openid-connect).

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or select a project and configure the OAuth consent screen.
2. Create an OAuth Client ID with application type **Web application**.
3. Add the frontend origin (for example `http://localhost:5500`) to **Authorized JavaScript origins**. Add the exact `GOOGLE_REDIRECT_URI` (for example `http://localhost:3000/api/auth/google/callback`) to **Authorized redirect URIs**.
4. Put the Client ID, Client Secret, and exact redirect URI in `.env` locally and in Vercel environment settings. Set `FRONTEND_APP_URL` to the app page for that deployment. Never put the Client Secret in `frontend/`.

When those values are absent, the Google button explains the missing backend configuration. OAuth still requires testing with the actual Google Console client and deployed domains.

## Deploy to Vercel

Recommended: import the repository with the project **Root Directory** set to the repository root. The root `vercel.json` serves `frontend/` as static output and rewrites `/api/*` to the single `api/index.js` function. Add the production environment variables above in Vercel Project Settings, then deploy. Configure the Atlas network access list for the deployed API's network access model.

The legacy `frontend/vercel.json` still supports deploying `frontend/` as a separate static project. That project has no backend function because its root is the frontend directory. Deploy the root project as the API and set `window.STUDYROOM_API_BASE` in `frontend/public/api-config.js` to the root deployment's HTTPS origin before deploying the frontend project. Add that frontend origin to the root deployment's `FRONTEND_URL` setting. The two deployments must use HTTPS.

Vercel Functions have execution-time, memory, request, and deployment-bundle limits that vary by plan and configuration. Sync uploads are capped at 4 MB and 500 rows per collection request, and pulls are paginated to keep requests bounded. See Vercel's [current function limits](https://vercel.com/docs/functions/limitations) and [Node.js runtime guide](https://vercel.com/docs/functions/runtimes/node-js); very large accounts may need multiple sync batches.

## Authentication and admin

Registration stores bcrypt password hashes and creates regular, enabled users. Signed JWTs are sent only in an HttpOnly cookie. Protected requests reload the user and reject disabled accounts. Admin routes require the server-side `role: "admin"` value and provide aggregate statistics, paginated account lists, role changes, and disable/enable actions. Activity is stored append-only in `activityLog`; admin aggregates use this collection, not the browser's capped activity list.

To create the first administrator, register the account through Studyroom, then run the following from a trusted environment with production MongoDB environment variables set:

```sh
npm run create-admin -- admin@example.com
```

This promotes the existing account and records an audit event. Do not expose a public admin registration route or commit credentials.

## Tests and checks

```sh
npm test
npm run test:api
find frontend/src/js -type f -name '*.js' -exec node --check {} \;
```

The API tests use an isolated MongoDB replica set through `mongodb-memory-server`, covering ownership, auth, role protection, disabled users, tombstones, conflicts, append-only activity, validation, admin access, import idempotency, and clear-data. The memory server may need to download its MongoDB test binary on the first run.

### Browser smoke checks

1. With the API and static frontend running, create an account. Confirm the app stays usable signed out and local data remains under `studyroom.v1`.
2. Create subjects, short and multiple-choice questions, flashcards, and an exam attempt. Sign in and choose **Import my data**. Refresh and confirm records remain; edit and delete records, then confirm they sync on a second browser signed into the same account.
3. Make conflicting edits to the same record on both devices while offline, reconnect, and verify the conflict chooser. Clear synced study data on one device and verify the other signed-in browser wipes its local study records while retaining its local photo.
4. Register a second account and confirm its sync pull is isolated. Promote the first account with the admin command, open Workspace Admin, and check account totals, recent events, role changes, and disable/re-enable behavior.
5. Export a backup, clear or switch browser storage, import the backup, and confirm existing content and settings load as before.

## Existing app behavior

- Use the app without signing in; local data remains in `studyroom.v1`.
- Sign in from the account/sync control to optionally migrate local records or use cloud records. If both sides contain data, choose the merge action; overlapping IDs are reviewed for conflicts.
- Export and Import continue using the existing backup JSON format.
- Profile photos stay local to the device. Clear-data clears synced study records and each signed-in browser's local study copy while preserving that browser's local profile photo.
- Workspace Admin displays local-only information for signed-out users and uses protected API aggregates for admins.
