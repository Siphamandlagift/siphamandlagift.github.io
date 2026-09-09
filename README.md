# LmsApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Backend server

The repository now includes a small persistent API server under `server/`. It stores LMS data in `server/data/lms-data.json` and exposes REST endpoints for offerings, learner snapshots, and assignment submissions.

Install dependencies and start the backend with:

```bash
npm run server:dev
```

The API listens on `http://localhost:3000` by default and the Angular app is configured to call `http://localhost:3000/api`.

For hosted deployments, the backend now supports `PORT`, `LMS_ALLOWED_ORIGINS`, and `LMS_DATA_DIRECTORY`, and the Angular frontend can read a runtime `app-config.json` file so you can point the Firebase-hosted site at a public API without rebuilding the whole app each time.

In hosted runtime, default CORS origins are restricted to the known production domains (no localhost). Set `LMS_ALLOWED_ORIGINS` explicitly if you need a custom allowlist.

The main LMS backend can also run on Firebase Functions. In that mode the repository automatically switches from the local JSON store to Firestore, using the root document configured by `LMS_FIRESTORE_COLLECTION` and `LMS_FIRESTORE_DOCUMENT_ID`.

The login page now authenticates against the backend API, and password reset emails are sent by the backend.

You can place the SMTP and app URL settings in a local `.env` file. An example is provided in `.env.example`.

Set these environment variables before starting the backend if you want emailed reset links to work:

```powershell
$env:LMS_APP_BASE_URL = "http://localhost:4200"
$env:LMS_SMTP_HOST = "smtp.your-provider.com"
$env:LMS_SMTP_PORT = "587"
$env:LMS_SMTP_SECURE = "false"
$env:LMS_SMTP_USER = "your-smtp-user"
$env:LMS_SMTP_PASS = "your-smtp-password"
$env:LMS_SMTP_FROM = "SkillsConnect LMS <no-reply@your-domain.com>"
```

Optional Microsoft Entra ID SSO (OIDC) can be enabled with:

```powershell
$env:LMS_SSO_MICROSOFT_CLIENT_ID = "your-app-client-id"
$env:LMS_SSO_MICROSOFT_CLIENT_SECRET = "your-app-client-secret"
$env:LMS_SSO_MICROSOFT_TENANT_ID = "your-tenant-id-or-organizations"
$env:LMS_SSO_MICROSOFT_REDIRECT_URI = "https://skillsconnect-f2275.web.app/api/auth/sso/microsoft/callback"
$env:LMS_SSO_ALLOWED_EMAIL_DOMAINS = "yourcompany.com"
```

Notes:

- Keep the existing username/password login enabled as fallback while rolling out SSO.
- The Entra app redirect URI must match your deployed callback URL exactly.
- SSO users must already exist as LMS users by email in the backend account store.

Seeded backend login accounts are:

- Administrator: `admin` / `admin`
- Training Manager: `manager` / `manager`
- Student: `student` / `student`

These seeded credentials are for local bootstrapping only. In hosted Firebase Functions runtime, default demo login pairs are blocked unless `LMS_ALLOW_DEMO_CREDENTIALS=true` is explicitly set.

Password policy for managed users and reset/change-password flows is enforced server-side: at least 12 characters with uppercase, lowercase, number, and symbol.

When SMTP is configured, the forgot-password flow sends a reset link to the matching account email. The link opens `/reset-password` in the Angular app and lets the user choose a new password that is then stored by the backend.

To build the backend separately, run:

```bash
npm run server:build
```

To start the compiled backend, run:

```bash
npm run server:start
```

## Firebase hosting

The frontend is deployed to Firebase Hosting at:

```text
https://skillsconnect-f2275.web.app
```

The earlier blank/empty deploy was caused by Firebase Hosting pointing at the wrong Angular output folder. Hosting now serves the app from `dist/lms-app/browser`.

When Hosting and the LMS API are deployed to the same Firebase project, the frontend does not need a custom `app-config.json` for the main LMS API. The app resolves hosted requests to `/api`, and Hosting now rewrites `api{,/**}` to the Firebase function named `api`.

If you want the deployed frontend to call a public API instead of localhost, add a runtime config file before deploying the frontend:

```json
{
	"lmsApiBaseUrl": "https://your-api-host.example.com/api"
}
```

Save that as `public/app-config.json`, run `npm run build`, then redeploy Firebase Hosting.

## Firebase backend deployment

The main LMS API can now be deployed to Firebase Functions with Firestore-backed persistence.

Before deploying, make sure you have:

1. Created a Firestore database in the Firebase project.
2. Added any production environment values you need in `.env`, especially `LMS_APP_BASE_URL`, SMTP settings, and optional Firestore collection overrides.
3. Confirmed the Cloud Build service account for the project can build Cloud Functions.

Build and deploy with:

```bash
npm run firebase:functions:build
npm run build
firebase deploy --only hosting,functions
```

If Cloud Functions deployment fails with a build-service-account permission error, grant the project's build service account the `roles/cloudbuild.builds.builder` role or configure a custom build service account before redeploying.

Firestore access from the browser is locked down in `firestore.rules`; the deployed API uses the Firebase Admin SDK on the server side.

## Operations runbook

### Health checks

- Hosted API health endpoint: `https://skillsconnect-f2275.web.app/api/health`
- Direct function health endpoint: `https://us-central1-skillsconnect-f2275.cloudfunctions.net/api/health`

### Logs

Inspect recent production API logs:

```bash
firebase functions:log --project skillsconnect-f2275 --only api --lines 100
```

### Firestore backups

Automated backups are configured for `(default)` with daily recurrence and 30-day retention.

Check the active schedule:

```bash
firebase firestore:backups:schedules:list --project skillsconnect-f2275
```

List available backups:

```bash
firebase firestore:backups:list --project skillsconnect-f2275 --location=us-central1
```

### Rollback

Rollback API/backend to previous stable source:

```bash
firebase deploy --only functions --project skillsconnect-f2275
```

Rollback frontend from the currently deployed live version to a target channel release:

```bash
firebase hosting:clone skillsconnect-f2275:live skillsconnect-f2275:<channel-id> --project skillsconnect-f2275
firebase hosting:channel:open <channel-id> --project skillsconnect-f2275
```

Deploy a new live frontend release:

```bash
npm run build
firebase deploy --only hosting --project skillsconnect-f2275
```

## Render backend deployment

This repository does not currently include a `render.yaml` blueprint file.

If you choose to host the main LMS API on Render, configure a standard Node Web Service manually with:

- Build command: `npm run server:build`
- Start command: `npm run server:start`
- Health check path: `/api/health`
- Persistent disk mounted at a path mapped to `LMS_DATA_DIRECTORY` if you use JSON-store mode

Manual Render deployment flow:

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repository (not Blueprint).
3. Set the build/start commands above.
4. Configure environment variables (`LMS_JWT_SECRET`, SMTP values, `LMS_ALLOWED_ORIGINS`, and optionally `LMS_DATA_DIRECTORY`).
5. After first deploy, note the public Render URL.
6. Update `public/app-config.json` with that URL as `lmsApiBaseUrl`, then rebuild and redeploy Firebase Hosting.

The backend uses `LMS_DATA_DIRECTORY` for its JSON store, so the Render service can keep `lms-data.json` and its backups on the mounted disk.

## Backend data coverage

The backend currently persists these LMS domains:

- Published training offerings
- Learner course snapshots derived from published offerings
- Learner notifications for newly published offerings
- Learner message threads and course progress snapshots
- Enrollment rosters and group changes
- Mentorship assignments and mentorship submission reviews
- Training manager message threads
- Assignment submissions and manager reviews

This gives the frontend a real persistence boundary without forcing a full service rewrite in one step.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
