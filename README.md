# Billing Backend

NestJS backend that powers the Billing Management Platform. This iteration focuses on a secure authentication layer that supports Admin, Collector, and Customer roles while keeping business data isolated from login data.

## Tech Stack

- [NestJS](https://nestjs.com/) + TypeScript
- PostgreSQL via TypeORM
- Class Validator / Transformer
- Bcrypt for hashing credentials and security answers

## Getting Started

1. Install dependencies
   ```bash
   yarn install
   ```
2. Configure environment variables by copying `.env.example` to `.env` and adjusting the PostgreSQL credentials (either a single `DATABASE_URL` such as your Supabase pooling link, or the individual host/port/user/password vars). Set `APP_TIMEZONE` (defaults to `Asia/Yangon`) if you want created/updated timestamps returned in a different local timezone. Example:
   ```bash
   cp .env.example .env
   ```
3. Run the development server
   ```bash
   yarn start:dev
   ```

The API listens on `http://localhost:4000` by default. Adjust the `PORT` var if needed.

### Create the first Admin

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```bash
yarn seed:admin
```

The script is idempotent—it skips creation if an account already exists for that email.

## Database

The app auto-loads entities and (outside production) will run schema syncs. Tables delivered with the current work:

- `users`: unified authentication table for all roles
- `collector_profiles`: business data for collectors (one-to-one with `users`)
- `customer_profiles`: business data for customers (optional link to `users`)
- `password_reset_tokens`: secure reset token ledger

Update the `.env` file with your PostgreSQL settings before running migrations or syncing.

## Authentication API

| Endpoint | Description |
| --- | --- |
| `POST /auth/login` | Username/email/phone + password login. Returns sanitized user profile and role info. |
| `POST /auth/collectors` | Admin-only endpoint to create Collector logins plus optional collector profile metadata. |
| `POST /auth/customers` | Admin-only endpoint to create Customer logins plus full intake payload (personal/business/contact/address/services/billing). |
| `POST /auth/forgot-password` | Generates a time-bound password reset token (returned in response for now; wire it to email/SMS later). |
| `POST /auth/reset-password` | Resets password via token from the previous step. |
| `POST /auth/change-password` | Authenticated password change flow that checks the current password before saving a new one. |
| `GET /users/:id` | Fetch a user plus their collector/customer profile details. |
| `PATCH /users/:id` | Update user info (name/email/phone/password) and, based on role, collector/customer metadata. |
| `GET /customers` | Retrieve all customers. |
| `PATCH /customers/:id` | Update core customer fields (contact/address/personal/business). |
| `GET /users` | Retrieve all users with their profiles. |
| `GET /collectors` | Retrieve all collectors. |
| `PATCH /collectors/:id` | Update collector profile and linked user basics. |
| `POST /plans` | Create a plan (planCode, planName, bandwidthPlan, monthlyFee, currency, isActive). |
| `PATCH /plans/:id` | Update a plan. |

All incoming DTOs are validated automatically via Nest's global `ValidationPipe`.

## API Docs

Swagger UI is live at [`/docs`](http://localhost:4000/docs) once the server is running. The specification is generated via `@nestjs/swagger`, so any new controllers/DTOs with Swagger decorators will show up automatically.

## Future Modules

- Customer Management, Collector assignment, Billing & Invoicing, and Reporting modules will build on the role-based setup delivered here.
- Guards and JWT issuance can be layered on top of the existing login service once the client-side auth flow is finalized.

## Scripts

- `yarn start:dev` – Run with live reload
- `yarn build` – Compile to `dist`
- `yarn test` – Execute unit tests (none yet for this module)
- `yarn lint` – ESLint + Prettier

## Deploy on Railway

1. Push this repo to GitHub.
2. Create a new Railway project and add:
   - your backend service from GitHub repo
   - a PostgreSQL service
3. In backend service settings, use:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start:prod`
4. Add environment variables in backend service:
   ```
   DATABASE_URL=<Railway Postgres connection URL>
   DB_SSL=true
   DB_SYNCHRONIZE=false
   NODE_ENV=production
   PORT=4000
   APP_TIMEZONE=Asia/Yangon
   CORS_ALLOWED_ORIGINS=https://billcollection.vercel.app
   ```
5. Attach a public domain from Railway and use that URL in frontend `NEXT_PUBLIC_API_BASE_URL`.

Notes:
- `DB_SYNCHRONIZE=false` is recommended in production.
- Use migrations for schema changes in production databases.

## Testing Notes

`yarn build` compiles the project and validates that the new modules wire up correctly. Add integration tests once database containers are available.
