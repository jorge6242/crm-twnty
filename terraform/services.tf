# ──────────────────────────────────────────────
# CRM API
# ──────────────────────────────────────────────
resource "railway_service" "crm_api" {
  name         = "CRM"
  project_id   = local.project_id
  source_image = "jgomez6242/symbiosecrm:latest"
}

resource "railway_service_domain" "crm_api" {
  subdomain      = "crmt-twenty"
  environment_id = local.environment_id
  service_id     = railway_service.crm_api.id
}

resource "railway_variable_collection" "crm_api_vars" {
  environment_id = local.environment_id
  service_id     = railway_service.crm_api.id

  variables = [
    # Base de datos y cache — Railway resuelve estas referencias automáticamente
    { name = "DATABASE_URL",              value = "$${{Postgres.DATABASE_URL}}" },
    { name = "PG_DATABASE_URL",           value = "$${{Postgres.DATABASE_URL}}" },
    { name = "REDIS_URL",                 value = "$${{Redis.REDIS_URL}}" },

    # Servidor
    { name = "NODE_ENV",                  value = var.node_env },
    { name = "PORT",                      value = var.port },
    { name = "SERVER_URL",                value = "https://${var.public_domain}" },
    { name = "FRONT_BASE_URL",            value = "https://${var.public_domain}" },
    { name = "FRONTEND_URL",              value = "https://${var.public_domain}" },
    { name = "REACT_APP_SERVER_BASE_URL", value = "https://${var.public_domain}" },
    { name = "TEMPORAL_BACKEND_BASE_URL", value = "https://${var.public_domain}" },

    # Storage
    { name = "STORAGE_TYPE",              value = var.storage_type },
    { name = "IS_FDW_ENABLED",            value = var.is_fdw_enabled },

    # Autenticación
    { name = "AUTH_PASSWORD_ENABLED",          value = var.auth_password_enabled },
    { name = "SIGN_IN_PREFILLED",              value = var.sign_in_prefilled },
    { name = "IS_EMAIL_VERIFICATION_REQUIRED", value = var.is_email_verification_required },
    { name = "AUTH_MICROSOFT_ENABLED",         value = var.auth_microsoft_enabled },
    { name = "MICROSOFT_TENANT_ID",            value = var.microsoft_tenant_id },
    { name = "MESSAGING_PROVIDER_MICROSOFT_ENABLED", value = var.messaging_provider_microsoft_enabled },
    { name = "CALENDAR_PROVIDER_MICROSOFT_ENABLED",  value = var.calendar_provider_microsoft_enabled },

    # Email
    { name = "EMAIL_DRIVER",         value = var.email_driver },
    { name = "EMAIL_FROM_ADDRESS",   value = var.email_from_address },
    { name = "EMAIL_FROM_NAME",      value = var.email_from_name },
    { name = "EMAIL_SYSTEM_ADDRESS", value = var.email_system_address },
    { name = "EMAIL_SMTP_HOST",      value = var.email_smtp_host },
    { name = "EMAIL_SMTP_PORT",      value = var.email_smtp_port },
    { name = "EMAIL_SMTP_USER",      value = var.email_smtp_user },

    # Integraciones
    { name = "UNIPILE_BASE_URL",    value = var.unipile_base_url },
    { name = "FULLENRICH_BASE_URL", value = var.fullenrich_base_url },
  ]
}

# ──────────────────────────────────────────────
# CRM Worker
# ──────────────────────────────────────────────
resource "railway_service" "crm_worker" {
  name         = "crm_worker"
  project_id   = local.project_id
  source_image = "jgomez6242/symbiosecrm:latest"
}

resource "railway_variable_collection" "crm_worker_vars" {
  environment_id = local.environment_id
  service_id     = railway_service.crm_worker.id

  variables = [
    # Base de datos y cache — Railway resuelve estas referencias automáticamente
    { name = "DATABASE_URL",              value = "$${{Postgres.DATABASE_URL}}" },
    { name = "PG_DATABASE_URL",           value = "$${{Postgres.DATABASE_URL}}" },
    { name = "REDIS_URL",                 value = "$${{Redis.REDIS_URL}}" },

    # Servidor
    { name = "NODE_ENV",                  value = var.node_env },
    { name = "PORT",                      value = var.port },
    { name = "SERVER_URL",                value = "https://${var.public_domain}" },
    { name = "FRONT_BASE_URL",            value = "https://${var.public_domain}" },
    { name = "FRONTEND_URL",              value = "https://${var.public_domain}" },
    { name = "REACT_APP_SERVER_BASE_URL", value = "https://${var.public_domain}" },
    { name = "TEMPORAL_BACKEND_BASE_URL", value = "https://${var.public_domain}" },

    # Storage
    { name = "STORAGE_TYPE",  value = var.storage_type },
    { name = "IS_FDW_ENABLED", value = var.is_fdw_enabled },

    # Autenticación
    { name = "AUTH_PASSWORD_ENABLED",          value = var.auth_password_enabled },
    { name = "SIGN_IN_PREFILLED",              value = var.sign_in_prefilled },
    { name = "IS_EMAIL_VERIFICATION_REQUIRED", value = var.is_email_verification_required },
    { name = "AUTH_MICROSOFT_ENABLED",         value = var.auth_microsoft_enabled },
    { name = "MICROSOFT_TENANT_ID",            value = var.microsoft_tenant_id },
    { name = "MESSAGING_PROVIDER_MICROSOFT_ENABLED", value = var.messaging_provider_microsoft_enabled },
    { name = "CALENDAR_PROVIDER_MICROSOFT_ENABLED",  value = var.calendar_provider_microsoft_enabled },

    # Email
    { name = "EMAIL_DRIVER",         value = var.email_driver },
    { name = "EMAIL_FROM_ADDRESS",   value = var.email_from_address },
    { name = "EMAIL_FROM_NAME",      value = var.email_from_name },
    { name = "EMAIL_SYSTEM_ADDRESS", value = var.email_system_address },
    { name = "EMAIL_SMTP_HOST",      value = var.email_smtp_host },
    { name = "EMAIL_SMTP_PORT",      value = var.email_smtp_port },
    { name = "EMAIL_SMTP_USER",      value = var.email_smtp_user },

    # Integraciones
    { name = "UNIPILE_BASE_URL",    value = var.unipile_base_url },
    { name = "FULLENRICH_BASE_URL", value = var.fullenrich_base_url },

    # Worker — overrides exclusivos
    { name = "DISABLE_DB_MIGRATIONS",          value = "true" },
    { name = "DISABLE_CRON_JOBS_REGISTRATION", value = "true" },
  ]
}
