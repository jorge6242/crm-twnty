terraform {
  required_providers {
    railway = {
      source = "terraform-community/railway"
      version = "~> 0.2.0"
    }
  }
}

provider "railway" {
  # RAILWAY_TOKEN should be set as an environment variable
}

resource "railway_project" "crm_symbiose" {
  name = "CRM Symbiose"
}

# --- Database: Postgres ---
resource "railway_service" "postgres" {
  name       = "Postgres"
  project_id = railway_project.crm_symbiose.id
  source {
    image = "ghcr.io/railwayapp-templates/postgres-ssl:18"
  }
}

# --- Database: Redis ---
resource "railway_service" "redis" {
  name       = "Redis"
  project_id = railway_project.crm_symbiose.id
  source {
    image = "redis:8.2.1"
  }

  # Custom Start Command for Redis
  configuration {
    start_command = "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\""
  }
}

# --- Service: CRM (API) ---
resource "railway_service" "crm_api" {
  name       = "CRM"
  project_id = railway_project.crm_symbiose.id
  source {
    image = "ghcr.io/symbiosem/symbiosecrm:latest"
  }

  configuration {
    pre_deploy_command = "npm run migrate"
    healthcheck_path   = "/health"
    healthcheck_timeout = 300
  }
}

# --- Service: CRM Worker ---
resource "railway_service" "crm_worker" {
  name       = "crm_worker"
  project_id = railway_project.crm_symbiose.id
  source {
    image = "ghcr.io/symbiosem/symbiosecrm:latest"
  }

  configuration {
    start_command = "node dist/queue-worker/queue-worker"
  }
}

# --- Variables ---

resource "railway_variable" "common_vars" {
  for_each = {
    for service in [railway_service.crm_api.id, railway_service.crm_worker.id] : service => service
  }

  service_id = each.value
  environment_id = railway_project.crm_symbiose.default_environment_id

  variables = {
    DATABASE_URL              = "${railway_service.postgres.variables.DATABASE_URL}"
    PG_DATABASE_URL           = "${railway_service.postgres.variables.DATABASE_URL}"
    REDIS_URL                 = "${railway_service.redis.variables.REDIS_URL}"
    # Use variable for domain to allow easy environment switching
    SERVER_URL                = "https://${var.public_domain}"
    FRONT_BASE_URL            = "https://${var.public_domain}"
    FRONTEND_URL              = "https://${var.public_domain}"
    REACT_APP_SERVER_BASE_URL = "https://${var.public_domain}"
    APP_SECRET                = var.app_secret
    STORAGE_TYPE              = "local"
    IS_FDW_ENABLED            = "false"
    SIGN_IN_PREFILLED         = "true"
    NODE_ENV                  = "production"
    PORT                      = "3000"
  }
}

# Worker specific overrides
resource "railway_variable" "worker_overrides" {
  service_id     = railway_service.crm_worker.id
  environment_id = railway_project.crm_symbiose.default_environment_id

  variables = {
    DISABLE_DB_MIGRATIONS           = "true"
    DISABLE_CRON_JOBS_REGISTRATION = "true"
  }
}
