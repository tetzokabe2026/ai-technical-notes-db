# AI Technical Notes DB Project Overview

## Overview

AI Technical Notes DB is a Next.js application for storing, searching, and classifying technical notes. It uses Supabase as the database and authentication platform, and it is designed to run as a container on Google Cloud Run.

Main features:

- Create, list, search, and delete technical notes
- Manage hierarchical categories
- Suggest note titles, categories, and tags with the OpenAI API
- Login, signup, and password reset with Supabase Auth
- Admin approval workflow for signup requests
- Admin user management, including approval, rejection, deletion, and password reset
- Per-user separation of notes and categories

## Technology Stack

- Frontend / Backend: Next.js App Router
- Language: TypeScript
- UI: React 19, Tailwind CSS
- Database: Supabase Postgres
- Authentication: Supabase Auth
- Mail Delivery: Resend through Supabase Auth Custom SMTP
- AI: OpenAI Responses API
- Deployment: Docker + Google Cloud Build + Google Cloud Run
- Container Registry: Google Artifact Registry

## Main Directories

```text
app/
  page.tsx                         Main note list, search, and creation screen
  categories/page.tsx              Category management screen
  login/page.tsx                   Login and password reset request screen
  signup/page.tsx                  Signup request screen
  setup/page.tsx                   Initial account setup after approval
  reset-password/page.tsx          Password reset screen
  admin/page.tsx                   Admin screen
  api/                             Next.js Route Handlers

lib/
  auth.ts                          Cookie session and authorization helpers
  supabase.ts                      Browser-side Supabase types and client
  supabase-server.ts               Service-role Supabase client
  supabase-auth.ts                 Supabase Auth client
  ai-classification.ts             OpenAI-based classification and category helpers
  url.ts                           Application URL helper

supabase/
  migrations/                      Database schema migration history
  config.toml                      Supabase CLI configuration

scripts/
  create-admin-user.mjs            Initial admin user creation script
  import-*.mjs                     Note import scripts

Dockerfile                         Production container definition
cloudbuild.yaml                    Cloud Build configuration
```

## Authentication and User Management

The application uses Supabase Auth for email/password login. The application-specific `app_users` table stores approval status, admin role, display user ID, and the mapping to the corresponding Supabase Auth user.

Signup flow:

1. A user submits an email address on `/signup`
2. The user is stored in `app_users` with `pending` status
3. An admin approves the request from `/admin`
4. The account is activated through the Supabase Auth invitation/setup flow
5. The user logs in with email address and password

Password reset uses Supabase Auth recovery emails. Email delivery is handled by Resend through Supabase Auth Custom SMTP.

## Data Separation

Technical notes and categories have an `owner_user_id` column. The application APIs only read and write data for the currently logged-in user. Most CRUD operations go through Next.js API routes instead of allowing broad direct database access from the browser.

Main tables:

- `app_users`
- `technical_notes`
- `categories`
- `ai_classification_runs`
- `note_ai_classifications`

Tables in the public Supabase schema have RLS enabled. The application generally performs database operations from server-side code using the service role.

## Deployment Architecture

Production runs on Google Cloud Run. CI/CD is handled by GitHub Actions.

```text
GitHub (push to main)
  -> GitHub Actions (CI: lint/build, CD: deploy)
  -> Artifact Registry
  -> Cloud Run
  -> Supabase / OpenAI / Resend
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for setup instructions.

Main Cloud Run environment variables and secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` via Secret Manager
- `OPENAI_API_KEY` via Secret Manager
- `OPENAI_MODEL`

## Development Commands

```bash
npm run dev
npm run lint
npm run build
npm run create-admin
```

To create the initial admin user, set `ADMIN_EMAIL`, `ADMIN_USER_ID`, and `ADMIN_PASSWORD` in `.env.local`, then run `npm run create-admin`.
