# ==========================================
# SECTION 1: INFRASTRUCTURE LAYER (DB & Redis)
# ==========================================

# Infrastructure Startup
infra-up:
	docker compose -f docker-compose.dev.yml up -d db redis

# Infrastructure Shutdown
infra-stop:
	docker compose -f docker-compose.dev.yml stop db redis

# Create Docker network (usually runs automatically, but available if needed)
network-create:
	@echo "🌐 Creating Docker network 'twenty_default'..."
	@docker network create twenty_default 2>/dev/null && echo "✅ Network created!" || echo "ℹ️  Network already exists."


# ==========================================
# SECTION 2: APPLICATION LAYER (Docker Dev)
# ==========================================

# Application Startup
app-up:
	docker compose -f docker-compose.dev.yml up -d twenty_app

# Application Shutdown
app-stop:
	docker compose -f docker-compose.dev.yml stop twenty_app


# ==========================================
# SECTION 3: MASTER COMMANDS
# ==========================================

# 🚀 SETUP: Initial setup or after a complete reset. Cleans, installs dependencies and prepares the DB.
# Run this:
#   - On first clone of the repository
#   - When you need a completely fresh start
#   - After major version upgrades
setup:
	@echo "🧹 Cleaning up previous containers and volumes..."
	docker compose -f docker-compose.dev.yml down -v --remove-orphans
	@echo "🌐 Ensuring Docker network exists..."
	docker network create twenty_default 2>/dev/null || echo "Network already exists, continuing..."
	@echo "🚀 Starting infrastructure containers..."
	@make infra-up
	@echo "🚀 Starting application container..."
	@make app-up
	@echo "⏳ Waiting for database to be ready..."
	@sleep 5
	@docker exec -it twenty_postgres pg_isready -U postgres -d default || (echo "❌ Database not ready, waiting longer..." && sleep 5)
	@echo "🧹 Cleaning Nx cache..."
	docker exec -it twenty-app npx nx reset || true
	@echo "📦 Installing dependencies (Monorepo)... This will take a few minutes."
	docker exec -it twenty-app yarn install
	@echo "🔨 Building server (this includes PersonJobHistory and all standard objects)..."
	docker exec -it twenty-app npx nx build twenty-server
	@echo "🗄️ Resetting database schema and seeding data..."
	docker exec -it twenty-app npx nx database:reset twenty-server
	@echo "✅ Setup complete!"
	@echo "✅ You can now run 'make start-all' (or 'make backend' + 'make worker' + 'make frontend' separately)."

# ☀️ UP: Daily development startup. Instantaneous as it doesn't reinstall anything.
up:
	@echo "🌐 Ensuring Docker network exists..."
	@docker network create twenty_default 2>/dev/null || echo "Network already exists, continuing..."
	@make infra-up
	@make app-up
	@echo "✅ Containers are ready. Happy coding!"

# 🛑 STOP-ALL: Stops all services while preserving node_modules. The recommended day-to-day stop command.
stop-all:
	@make app-stop
	@make infra-stop

# 🧹 DOWN: Removes app containers and networks. (Use only if something fails)
down:
	docker compose -f docker-compose.dev.yml down


# ==========================================
# SECTION 4: DEVELOPMENT COMMANDS (Inside Container)
# ==========================================

# Reinstall dependencies
install:
	docker exec -it twenty-app yarn install

# Reset database structure and seed data
db-reset:
	docker exec -it twenty-app npx nx database:reset twenty-server

# Rebuild server code without resetting the database
# Use this when you modify TypeScript code but don't need to reset DB
rebuild:
	@echo "🔨 Cleaning Nx cache..."
	docker exec -it twenty-app npx nx reset
	@echo "🔨 Rebuilding server..."
	docker exec -it twenty-app npx nx build twenty-server
	@echo "✅ Rebuild complete!"

# Sync workspace metadata after adding or modifying workspace entities (standard-objects).
# Run this whenever a new WorkspaceEntity is created, a field is added/removed, or a
# universalIdentifier changes. It attempts to apply the diff to ALL active and suspended
# workspaces without losing data.
# ⚠️  WARNING: This may fail if your database has inconsistent state (e.g., missing widgets
# from incomplete migrations). In that case, you'll need to run 'make db-reset' instead.
# Only use in production after thorough testing in dev/staging environments.
workspace-sync:
	@echo "🔨 Building server with latest code..."
	docker exec -it twenty-app npx nx build twenty-server
	@echo "🔄 Syncing workspace metadata..."
	docker exec -it twenty-app npx nx run twenty-server:command workspace:sync-standard-objects --skip-nx-cache
	@echo "✅ Workspace sync complete!"

# Start the Backend service
backend:
	docker exec -it twenty-app npx nx start twenty-server

# Start the Worker service (processes cronjobs)
worker:
	docker exec -it twenty-app npx nx run twenty-server:worker

# Start the Frontend service
frontend:
	docker exec -it twenty-app npx nx start twenty-front

# Start everything (Backend + Frontend + Worker) - Recommended for full development
start-all:
	docker exec -it twenty-app yarn start


# ==========================================
# SECTION 5: DEBUGGING & VERIFICATION
# ==========================================

# Verify that a standard object exists in the database
# Usage: make verify-object OBJECT=personJobHistory
verify-object:
	@echo "🔍 Checking if '$(OBJECT)' exists in metadata..."
	@docker exec -it twenty_postgres psql -U postgres -d default -c "SELECT \"nameSingular\", \"namePlural\", \"isActive\", COUNT(*) OVER() as total_workspaces FROM core.\"objectMetadata\" WHERE \"nameSingular\" = '$(OBJECT)';" || echo "❌ Object not found!"

# List all standard objects in the current workspace
list-objects:
	@echo "📋 Listing all objects in the first workspace..."
	@docker exec -it twenty_postgres psql -U postgres -d default -c "SELECT \"nameSingular\", \"isCustom\", \"isActive\" FROM core.\"objectMetadata\" WHERE \"workspaceId\" = (SELECT id FROM core.workspace LIMIT 1) ORDER BY \"createdAt\" DESC LIMIT 50;"

# Check database connection and basic info
db-info:
	@echo "🔍 Database connection info..."
	@docker exec -it twenty_postgres psql -U postgres -d default -c "SELECT COUNT(*) as total_objects FROM core.\"objectMetadata\";"
	@docker exec -it twenty_postgres psql -U postgres -d default -c "SELECT COUNT(*) as total_workspaces FROM core.workspace;"
	@docker exec -it twenty_postgres psql -U postgres -d default -c "SELECT schemaname FROM pg_tables WHERE schemaname LIKE 'workspace_%' GROUP BY schemaname;"

# Enter database shell (for manual SQL queries)
db-shell:
	docker exec -it twenty_postgres psql -U postgres -d default

# View server logs
logs:
	docker logs -f twenty-app

# Enter app container shell
shell:
	docker exec -it twenty-app bash


# ==========================================
# SECTION 6: COMMON WORKFLOWS & EXAMPLES
# ==========================================
#
# 📖 WORKFLOW 1: First-time setup
#    $ make setup
#    $ make start-all   (starts backend + frontend + worker in one terminal)
#    OR separately:
#    $ make backend     (in terminal 1)
#    $ make worker      (in terminal 2)
#    $ make frontend    (in terminal 3)
#
# 📖 WORKFLOW 2: Daily development
#    $ make up
#    $ make start-all   (or make backend + make worker + make frontend separately)
#    # ... end of day ...
#    $ make stop-all
#
# 📖 WORKFLOW 3: Testing cronjobs (requires worker)
#    $ make up
#    $ docker exec -it twenty-app npx nx run twenty-server:command -- cron:register:all
#    $ make start-all   (includes worker that executes cronjobs)
#    # Watch logs in another terminal:
#    $ make logs
#
# 📖 WORKFLOW 4: Adding a new standard object (like PersonJobHistory)
#    1. Create your .workspace-entity.ts file
#    2. Add IDs in standard-object-ids.ts and standard-field-ids.ts
#    3. Register in standard-object.constant.ts
#    4. Create compute-[object]-standard-flat-field-metadata.util.ts
#    5. Register builder in create-standard-flat-object-metadata.util.ts
#    6. Add bidirectional relations in related entities
#    7. Run: make rebuild
#    8. Run: make workspace-sync
#    9. Verify: make verify-object OBJECT=yourObjectName
#
# 📖 WORKFLOW 5: When workspace-sync fails with validation errors
#    This usually means your DB has inconsistent state. Solutions:
#    - Quick fix (dev only): make db-reset
#    - Investigate: make db-shell (then run SQL queries to check state)
#    - Check logs: make logs
#
# 📖 WORKFLOW 6: Rebuilding after code changes
#    - Code-only changes: make rebuild
#    - New entity/schema changes: make rebuild && make workspace-sync
#    - Everything broken: make db-reset
#
# 📖 WORKFLOW 7: Verifying your changes
#    $ make verify-object OBJECT=personJobHistory
#    $ make list-objects
#    $ make db-info
#
# ⚠️  IMPORTANT NOTES:
#    - Always run 'make rebuild' before 'make workspace-sync' to ensure
#      the latest compiled code is used
#    - workspace-sync is incremental and preserves data, but may fail if
#      DB is in inconsistent state
#    - db-reset is destructive but guarantees clean state
#    - In production, test workspace-sync in staging first!
#
# 🔧 TROUBLESHOOTING:
#    - Error "network twenty_default declared as external, but could not be found":
#      Run: make network-create
#      This network is automatically created by 'make setup' and 'make up'
#
#    - Containers not starting:
#      Check: docker ps -a
#      Check logs: make logs
#      Nuclear option: make setup (resets everything)
#
