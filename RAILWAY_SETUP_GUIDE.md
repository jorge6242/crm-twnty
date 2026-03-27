# Railway Setup Guide — Twenty CRM

Step-by-step technical guide for deploying Twenty CRM on Railway. This documents the exact steps taken to get the application running.

## Prerequisites

- Railway account (Pro plan recommended — Hobby plan has execution limits)
- Railway CLI installed: `npm install -g @railway/cli`
- Node.js 24+ and Yarn 4
- Access to the GitHub repository
- GitHub Container Registry (GHCR) access — images are built via GitHub Actions and pulled by Railway
- GitHub Personal Access Token (PAT) with `read:packages` scope — required for Railway to pull private GHCR images
- Railway Project Token — required for CI/CD pipeline to trigger redeploys

## Step 0: Generate Required Tokens

You need two tokens for the setup:

### A) GitHub Personal Access Token (PAT)
Required for Railway to pull private images from GHCR.

1.  GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2.  Generate new token with `read:packages` (and `repo` if repo is private)
3.  **Copy it immediately.** Used in Service Settings → Registry Credentials.

### B) Railway Project Token
Required for GitHub Actions to trigger redeploys.

1.  [railway.app](https://railway.app) → Project → **Settings** → **Tokens** → **New Token**
2.  Name it (e.g., `prod`) for the **production** environment.
3.  Copy and add to GitHub → **Settings** → **Secrets** → **Actions** as `RAILWAY_TOKEN`.

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and create a new **Empty Project**
2. Name the project (e.g., `amusing-courtesy`)

## Step 2: Add PostgreSQL Plugin

1. Inside the project, click **"+ New"** → **"Database"** → **PostgreSQL**
2. Railway provisions a PostgreSQL instance with a volume for persistence
3. Default configuration is sufficient — no manual extension setup needed
4. Extensions `uuid-ossp` and `unaccent` are enabled automatically by Twenty on first run via `setup-db.ts`

## Step 3: Add Redis Plugin

1. Click **"+ New"** → **"Database"** → **Redis**
2. **Critical:** Update the Redis **Custom Start Command** in Settings → Deploy to include `--maxmemory-policy noeviction`:

```
/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"
```

> **Why noeviction?** BullMQ stores job data in Redis. If Redis evicts keys under memory pressure, jobs are silently lost. The `noeviction` policy makes Redis return errors instead of deleting data, which BullMQ handles gracefully with retries.

## Step 4: Create API Service

1. Click **"+ New"** → **"Empty Service"**
2. Name it (e.g., `CRM` or `twenty-api`)

### Settings Configuration

1. **Source Image:** `ghcr.io/symbiosem/symbiosecrm:latest`
2. **Pre-deploy:** `npm run migrate`
3. **Healthcheck:** `/health` (Timeout: 300s)
4. **Registry Credentials:** Paste the **GitHub PAT** from Step 0A.

> [!IMPORTANT]
> Without the GitHub PAT in **Registry Credentials**, deploys will fail with: *"We were unable to connect to the registry"*.

### Networking

Click **"Generate Domain"** to get a public URL. Note this URL — you will need it for environment variables.

### Environment Variables

Go to the **Variables** tab → **Raw Editor** and paste:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PG_DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
SERVER_URL=https://<your-generated-domain>.up.railway.app
FRONT_BASE_URL=https://<your-generated-domain>.up.railway.app
FRONTEND_URL=https://<your-generated-domain>.up.railway.app
REACT_APP_SERVER_BASE_URL=https://<your-generated-domain>.up.railway.app
APP_SECRET=<generate-with-openssl-rand-base64-32>
STORAGE_TYPE=local
IS_FDW_ENABLED=false
SIGN_IN_PREFILLED=true
NODE_ENV=production
PORT=3000
```

> **Important:** Replace `<your-generated-domain>` with the actual Railway domain. All four URL variables (`SERVER_URL`, `FRONT_BASE_URL`, `FRONTEND_URL`, `REACT_APP_SERVER_BASE_URL`) must match exactly — a mismatch causes CORS errors.

> **Generate APP_SECRET:** Run `openssl rand -base64 32` in your terminal.

> **Railway reference syntax:** `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` are Railway variable references — Railway automatically resolves them to the actual connection strings.

## Step 5: First Deploy

The first deploy happens automatically when you configure the Docker Image source. Railway pulls `ghcr.io/symbiosem/symbiosecrm:latest` and starts the service.

> **Note:** The image must exist in GHCR before configuring Railway. The CI/CD pipeline (GitHub Actions) builds and pushes the image on every push to `main`.

### What happens on first deploy

The `entrypoint.sh` automatically:
1. Detects the database is empty (no `core` schema)
2. Runs `setup-db.ts` to initialize the database
3. Runs `yarn database:migrate:prod` for schema migrations
4. Runs `yarn command:prod upgrade` for data migrations
5. Runs `yarn command:prod cron:register:all` to register background jobs
6. Starts the server with `node dist/main`

### Verify

Open the Railway-generated URL in your browser:
- Frontend should load with the Twenty CRM login page
- Click **"Continue with Email"** and use the prefilled credentials
- Check `https://<your-domain>.up.railway.app/health` returns 200

## Step 6: Create Worker Service

1. Click **"+ New"** → **"Empty Service"**
2. Name it (e.g., `crm_worker`)

### Settings Configuration

1. **Source Image:** `ghcr.io/symbiosem/symbiosecrm:latest`
2. **Custom Start Command:** `node dist/queue-worker/queue-worker`
3. **Registry Credentials:** Same GitHub PAT configuration as the API service.

**Do NOT configure:**
- Healthcheck Path — the worker has no HTTP endpoint
- Public Domain — the worker does not receive HTTP traffic
- Pre-deploy Command — leave empty

### Environment Variables

Use the API service variables and add/modify:

```
APP_SECRET=<same-secret-as-api-service>
DISABLE_DB_MIGRATIONS=true
DISABLE_CRON_JOBS_REGISTRATION=true
```

> **Critical:** `DISABLE_DB_MIGRATIONS` and `DISABLE_CRON_JOBS_REGISTRATION` must be true for the worker.

### Deploy Worker

The worker deploys automatically alongside the API service via the CI/CD pipeline. Both services pull the same GHCR image — they only differ in their start command.

The worker starts processing BullMQ jobs from the 16 Redis queues (webhooks, messaging, calendars, workflows, billing, etc.).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **GHCR Pull Failure** | Ensure GitHub PAT is correctly set in **both** services' Registry Credentials. |
| **CORS / Login Error** | Ensure `SERVER_URL` and `FRONTEND_URL` match the Railway domain exactly. |
| **Build Limit** | Increase `MAIN_CHUNK_SIZE_LIMIT` in `packages/twenty-front/vite.config.ts`. |
| **Worker Inactive** | Check `REDIS_URL` matches and `DISABLE_DB_MIGRATIONS=true` is set. |

## CI/CD Pipeline

Deploys are automated via GitHub Actions on push to `main`.

### Required GitHub Secrets
- `RAILWAY_TOKEN`: Project token.
- `RAILWAY_API_SERVICE_ID`: API service ID.
- `RAILWAY_WORKER_SERVICE_ID`: Worker service ID.

### Flow
1. **GitHub Actions:** Builds Docker image and pushes to GHCR.
2. **Redeploy:** Triggers parallel redeploys for API and Worker.
