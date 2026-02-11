# ==========================================
# SECTION 1: INFRASTRUCTURE LAYER (DB & Redis)
# ==========================================

# Infrastructure Startup (Uses the file in packages/twenty-docker)
infra-up:
	docker compose -f packages/twenty-docker/docker-compose.yml up -d db redis

# Infrastructure Shutdown
infra-stop:
	docker compose -f packages/twenty-docker/docker-compose.yml stop db redis


# ==========================================
# SECTION 2: APPLICATION LAYER (Docker Dev)
# ==========================================

# Application Startup (Uses the root directory file)
app-up:
	docker compose -f docker-compose.dev.yml up -d app

# Application Shutdown
app-stop:
	docker compose -f docker-compose.dev.yml stop app


# ==========================================
# SECTION 3: MASTER COMMANDS
# ==========================================

# 🚀 SETUP: Initial setup or after a complete reset. Installs dependencies and prepares the DB.
setup:
	@make infra-up
	@make app-up
	@echo "⏳ Waiting 2s for containers to establish connections..."
	@sleep 2
	@echo "📦 Installing dependencies (Monorepo)... This will take a few minutes."
	docker exec -it twenty-app yarn install --immutable --immutable-cache
	@echo "🗄️ Initializing the database..."
	docker exec -it twenty-app npx nx database:reset twenty-server
	@echo "✅ Setup complete. You can now run 'make backend' and 'make frontend'."

# ☀️ UP: Daily development startup. Instantaneous as it doesn't reinstall anything.
up:
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

# Start the Backend service
backend:
	docker exec -it twenty-app npx nx start twenty-server

# Start the Frontend service
frontend:
	docker exec -it twenty-app npx nx start twenty-front
