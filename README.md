# Symbiose CRM

Minimal local development configuration for Twenty CRM: environment files, Docker services (Postgres and Redis), and a sample frontend view to validate the application.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Make command available

### Initial Setup

Run this command for the first-time setup or after a complete reset:

```bash
make setup
```

This command will:
- 🧹 Clean up previous containers and volumes
- 🚀 Start infrastructure containers (PostgreSQL & Redis)
- 🚀 Start the application container
- 📦 Install all dependencies (monorepo)
- 🗄️ Create database schema and seed data

### Daily Development

For daily development startup (instantaneous, doesn't reinstall anything):

```bash
make up
```

### Development Services

After starting containers, run these commands in separate terminals:

```bash
# Start backend server
make backend

# Start frontend server (in another terminal)
make frontend
```

### Useful Commands

```bash
# Stop all services (preserves node_modules)
make stop-all

# Reset database
make db-reset

# Reinstall dependencies
make install

# Complete cleanup (removes containers and networks)
make down
```

## 📁 Project Structure

- `packages/twenty-server/` - NestJS backend application
- `packages/twenty-front/` - React frontend application
- `docker-compose.dev.yml` - Development Docker configuration
- `makefile` - Development automation commands

## 🔧 Environment Configuration

The project uses environment variables for configuration. Make sure to set up the required environment files before running the initial setup.
