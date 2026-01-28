# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

This repository contains the **Acquisitions API** – a Node.js 20+ Express application that exposes authentication and user-management endpoints backed by a Neon (PostgreSQL) database via Drizzle ORM. The project is ESM (`"type": "module"` in `package.json`) and uses Arcjet for security (bot detection, rate limiting, shield protection), Zod for input validation, and Winston + Morgan for logging.

The high-level architecture (also described in `README.md`) is:

- **HTTP layer**: Express server with security-related middleware (`helmet`, CORS, JSON/body parsing, cookie parsing, Arcjet-based rate limiting and bot detection).
- **Controller layer**: Maps HTTP routes to controller functions responsible for request validation and shaping responses.
- **Service layer**: Business logic and database interaction orchestration.
- **Data layer**: Drizzle ORM models talking to a Neon-hosted PostgreSQL database.

## Key Commands

Unless otherwise noted, run these from the repository root.

### Dependency installation

- Install dependencies (matches Docker image behavior and ensures lockfile is respected):

  ```bash
  npm ci
  ```

### Local development (without Docker)

- Start the API in watch mode (reload on file changes):

  ```bash
  npm run dev
  ```

- Start the API in non-watch, production-like mode:

  ```bash
  npm start
  ```

Environment loading is handled by `dotenv` via top-level `import 'dotenv/config';` in `src/index.js` and `drizzle.config.js`. Ensure the appropriate environment file (`.env`, `.env.development`, etc.) is present before running these commands.

### Linting and formatting

The repo uses ESLint + Prettier, configured via `devDependencies` and scripts in `package.json`:

- Lint the entire project:

  ```bash
  npm run lint
  ```

- Lint and auto-fix where possible:

  ```bash
  npm run lint:fix
  ```

- Format code with Prettier:

  ```bash
  npm run format
  ```

- Check formatting without writing changes:

  ```bash
  npm run format:check
  ```

### Database / Drizzle migrations

Migrations are configured via `drizzle.config.js` with schema in `src/models/*.js` and output in `./drizzle`.

- Generate a new migration when models change:

  ```bash
  npm run db:generate
  ```

- Apply migrations (uses `process.env.DATABASE_URL`):

  ```bash
  npm run db:migrate
  ```

- Open Drizzle Studio for inspecting the database:

  ```bash
  npm run db:studio
  ```

When running under Docker Compose, the `DATABASE_URL` is typically set via `.env.development` or `.env.production`. In development, the `DATABASE_URL` should point to the Neon Local proxy (see `docker-compose.dev.yml` and `src/config/database.js`).

### Docker-based workflows

There are two shell scripts in `scripts/` that wrap Docker Compose setups. They are wired via `package.json` scripts.

#### Development with Neon Local (Docker)

- Start the full development stack (Neon Local + app) via the wrapper script:

  ```bash
  npm run dev:docker
  ```

  This script (`scripts/dev.sh`) will:

  - Verify `.env.development` exists (used by both the app and the `neon-local` service).
  - Verify Docker is running.
  - Ensure a `.neon_local/` directory exists and is ignored by Git.
  - Run `npm run db:migrate` to apply the latest DB schema.
  - Wait for the Neon Local proxy to be ready.
  - Start `docker compose -f docker-compose.dev.yml up --build`.

- The development Docker Compose file is `docker-compose.dev.yml`:

  - Service `neon-local`: Neon Local proxy exposing PostgreSQL on `localhost:5432`.
  - Service `app`: builds from the `Dockerfile` `development` stage, exposes port `3000`, mounts `./src` and `./logs`, and participates in the `acquisitions-network` bridge network.

From the host, the API is available at:

- `http://localhost:3000` (root).
- `http://localhost:3000/health` (health check).
- `http://localhost:3000/api` (API status endpoint).

The `README.md` also documents equivalent direct Docker Compose commands, e.g.:

- Bring up the dev stack:

  ```bash
  docker-compose -f docker-compose.dev.yml up --build
  ```

- View logs for the dev stack:

  ```bash
  docker-compose -f docker-compose.dev.yml logs
  ```

- Tear down the dev stack (and the associated ephemeral Neon Local branch):

  ```bash
  docker-compose -f docker-compose.dev.yml down
  ```

> Note: Some script names in `README.md` use the `docker:*` prefix (e.g. `npm run docker:dev`), whereas `package.json` currently defines `dev:docker` and `prod:docker`. Prefer the actual script names from `package.json` when in doubt.

#### Production stack (Docker)

- Start the production stack via the wrapper script:

  ```bash
  npm run prod:docker
  ```

  This script (`scripts/prod.sh`) will:

  - Verify `.env.production` exists.
  - Verify Docker is running.
  - Run `docker compose -f docker-compose.prod.yml up --build -d` to start the stack in detached mode.
  - Run `npm run db:migrate` to apply the latest schema against the production `DATABASE_URL`.

- The production Compose file is `docker-compose.prod.yml`:

  - Service `app`: builds from the `Dockerfile` `production` stage, container name `acquisitions-app-prod`, exposes `3000`, mounts `./logs`, has a healthcheck hitting `/health`, and resource limits configured under `deploy.resources`.
  - Service `nginx`: optional reverse proxy/load balancer on ports `80` and `443`, using `nginx.conf` and SSL certificate files mounted from `./ssl`.

To inspect logs directly via Docker Compose rather than relying on script-printed examples, use:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

### Tests

As of the current `package.json`, there is **no test script or test runner configured** (no `test`/`jest`/`vitest`/`mocha` scripts are defined, and there are no `*.test.*`/`*.spec.*` files under `src/`). Running a single test or test suite will require adding an appropriate test framework and scripts first.

## Architecture and Code Structure

This section summarizes the important cross-cutting structure so that future agents can understand where to plug in new functionality.

### Entry points and HTTP layer

- **Entry point**: `src/index.js`
  - Loads environment variables via `import 'dotenv/config';`.
  - Imports and executes `./server.js`.
- **Server bootstrap**: `src/server.js`
  - Imports the Express app from `./app.js`.
  - Starts listening on `process.env.PORT || 3000` and logs the URL.
- **Application setup**: `src/app.js`
  - Creates the Express `app` instance.
  - Applies global middleware (in this approximate order):
    - `helmet()` – HTTP security headers.
    - `cors()` – CORS policy (default open, no custom config at present).
    - `express.json()` and `express.urlencoded({ extended: true })` – body parsing.
    - `cookieParser()` – cookie parsing.
    - `morgan(' combined', { stream: { write: (msg) => logger.info(msg.trim()) } })` – HTTP access logging piped into the Winston logger.
    - `securityMiddleware` – Arcjet-based security/rate limiting (see below).
  - Defines health and status endpoints:
    - `GET /` – basic status text, logs a message via the shared logger.
    - `GET /health` – JSON payload with `status`, `timestamp`, and `uptime`.
    - `GET /api` – simple API status JSON.
  - Mounts feature routers:
    - `app.use('/api/auth', authRoutes)` – authentication routes.
    - `app.use('/api/users', usersRoutes)` – user-related routes.

All HTTP traffic flows through this stack, so new global behavior (e.g., error handling, authentication guards) should be wired into `app.js` at the appropriate point in the middleware chain.

### Path aliases and module system

`package.json` defines ESM `imports` aliases that are heavily used throughout the codebase:

- `#config/*` → `./src/config/*`
- `#controllers/*` → `./src/controllers/*`
- `#middleware/*` → `./src/middleware/*`
- `#models/*` → `./src/models/*`
- `#routes/*` → `./src/routes/*`
- `#services/*` → `./src/services/*`
- `#utils/*` → `./src/utils/*`
- `#validations/*` → `./src/validations/*`

Any new modules should prefer these aliases rather than deep relative paths to stay consistent with existing imports.

### Controllers, services, and routes

The code follows a clear controller–service–model layering for the authentication and user flows:

- **Auth flow**:
  - Routes in `src/routes/auth.routes.js` define:
    - `POST /api/auth/sign-up` → `signup` controller.
    - `POST /api/auth/sign-in` → `signin` controller.
    - `POST /api/auth/sign-out` → `signout` controller.
  - Controllers in `src/controllers/auth.controller.js`:
    - Use Zod schemas from `src/validations/auth.validation.js` to validate request bodies.
    - Use `formatValidationError` from `src/utils/format.js` to return readable error summaries.
    - Delegate to service functions from `src/services/auth.service.js` (`createUser`, `authenticateUser`).
    - Use `jwttoken` from `src/utils/jwt.js` to sign JWTs and `cookies.set` from `src/utils/cookies.js` to set the `token` HTTP-only cookie.
    - Log success events through the shared Winston logger (`#config/logger.js`).

- **User flow**:
  - Routes in `src/routes/users.routes.js`:
    - `GET /api/users/` → `fetchAllUsers` controller.
    - Placeholder handlers for `GET/PUT/DELETE /api/users/:id` currently return simple text responses.
  - Controller in `src/controllers/users.controller.js`:
    - Logs when fetching users, delegates to `getAllUsers` in `src/services/users.service.js`.

- **Service layer**:
  - `src/services/auth.service.js`:
    - Implements password hashing and comparison with `bcrypt`.
    - Uses Drizzle ORM with `users` model and `eq` to enforce email uniqueness and retrieve users.
    - Wraps DB calls with logging and rethrows errors for controller-level handling.
  - `src/services/users.service.js`:
    - Uses aliases `#config/database.js` and `#models/user.model.js` to query the DB.
    - Returns selected user fields (no password) for consumption by controllers.

- **Model layer**:
  - `src/models/user.model.js` defines the `users` table using Drizzle's `pgTable` DSL, including constraints like unique `email` and default `role` of `'user'`.

New business logic should follow this pattern: router → controller (validation, shaping response) → service (business logic) → model/DB.

### Database and environment behavior

- **Database configuration**: `src/config/database.js`
  - Uses `@neondatabase/serverless` (`neon`) and `drizzle-orm/neon-http`.
  - Exports `db` (Drizzle instance) and `sql` (raw Neon client).
  - In `NODE_ENV === 'development'`, it overrides `neonConfig` to talk to the Neon Local proxy (`http://neon-local:5432/sql`), disables secure websockets, and uses fetch-based pooling. This is coordinated with the `neon-local` service in `docker-compose.dev.yml`.
  - `process.env.DATABASE_URL` must be set appropriately (see `.env.development`, `.env.production`, and `README.md`).

- **Drizzle configuration**: `drizzle.config.js`
  - Points `schema` to `./src/models/*.js` and `out` to `./drizzle`.
  - Relies on `process.env.DATABASE_URL` and `dotenv/config` for credentials, so environment variables must be available when running Drizzle CLI commands.

- **Environment files**:
  - `.env.development` – used by dev workflows and `docker-compose.dev.yml` (contains `NODE_ENV=development`, `DATABASE_URL` pointing at Neon Local, JWT secret, Arcjet key, and Neon API credentials for managing branches).
  - `.env.production` – expected by `scripts/prod.sh` and `docker-compose.prod.yml` (not committed; should contain production `DATABASE_URL`, JWT secret, Arcjet key, etc.).
  - `.env.example` – template for environment configuration (update values before use; do not commit real secrets).

Future agents should **avoid printing or copying actual secret values** from any `.env*` files into logs, commit messages, or documentation.

### Security and middleware (Arcjet, JWT, cookies)

- **Arcjet configuration**: `src/config/arcjet.js`
  - Creates a base Arcjet client with global rules:
    - `shield({ mode: 'LIVE' })` – generic protection against common attack patterns.
    - `detectBot({ mode: 'LIVE', allow: [...] })` – bot detection with allowances for search engines/previews.
    - A default `slidingWindow` rule with interval `2s` and `max: 5`.

- **Security middleware**: `src/middleware/security.middleware.js`
  - Wraps the base Arcjet client and adds **role-aware rate limiting** using `aj.withRule(slidingWindow(...))` on a per-request basis.
  - Rate limits are determined by `req.user?.role`:
    - `admin`: 20 requests per minute.
    - `user`: 10 requests per minute.
    - `guest` (default when `req.user` is absent): 5 requests per minute.
  - Denied decisions are handled explicitly:
    - Bot traffic → `403` with "Automated requests are not allowed" and structured logs.
    - Shield-triggered events → `403` with "Request blocked by security policy".
    - Rate limit exceeded → `403` with "Too many requests".

> Important: There is currently **no middleware that populates `req.user` from the JWT**. The security middleware assumes `req.user` may be present, but it is not set by default. Any future authentication/authorization middleware that decodes the `token` cookie and attaches `req.user` should be mounted **before** `securityMiddleware` in `app.js` if you want per-role rate limits to reflect the authenticated user.

- **JWT utilities**: `src/utils/jwt.js`
  - Wraps `jsonwebtoken` with a `jwttoken` helper exposing:
    - `jwttoken.sign(payload)` – signs tokens with `JWT_SECRET` and 1-day expiration.
    - `jwttoken.verify(token)` – verifies tokens and throws an error on failure.
  - Logs token-related errors to the shared logger.

- **Cookie utilities**: `src/utils/cookies.js`
  - Centralizes cookie options (HTTP-only, `sameSite: 'strict'`, and `secure` in production).
  - Provides `set(res, name, value, options?)`, `clear(res, name, options?)`, and `get(...)` helpers.
  - Controllers use `cookies.set` and `cookies.clear` to handle the `token` cookie for sign-in/out flows.

### Logging and observability

- **Logger configuration**: `src/config/logger.js`
  - Creates a Winston logger with:
    - Log level from `LOG_LEVEL` env var (default `info`).
    - Timestamped, JSON-formatted logs including stack traces for errors.
    - File transports:
      - `logs/error.lg` for errors.
      - `logs/combined.log` for all logs.
    - Console transport in non-production environments with colorized, simple output.

- **HTTP access logging**:
  - `src/app.js` uses `morgan` with a custom stream to send HTTP logs into the same Winston logger.

- **Docker integration**:
  - The `Dockerfile` and Compose files ensure a `logs/` directory exists and is mounted into containers so logs persist outside the container filesystem.

### Adding new functionality

When extending the API, follow these patterns to stay aligned with the existing structure:

- Use **path aliases** (e.g., `#services/...`, `#controllers/...`) for new modules.
- For new endpoints, add:
  - Route definitions under `src/routes/`.
  - Controllers under `src/controllers/` that validate input with Zod and use shared utilities (cookies, JWTs, formatters).
  - Service-layer functions under `src/services/` for business logic and DB access.
  - Drizzle model changes under `src/models/`, then update migrations via `npm run db:generate` and `npm run db:migrate`.
- If adding authentication/authorization middleware that uses `jwttoken.verify`, mount it early in `app.js` (before `securityMiddleware`) to ensure `req.user` is set for role-aware rate limiting.
