variable "public_domain" {
  description = "Dominio público generado por Railway para el servicio CRM"
  type        = string
}

variable "node_env" {
  description = "Node environment"
  type        = string
  default     = "production"
}

variable "port" {
  description = "Puerto del servidor"
  type        = string
  default     = "3000"
}

variable "storage_type" {
  description = "Tipo de storage (local o s3)"
  type        = string
  default     = "local"
}

variable "is_fdw_enabled" {
  description = "Habilitar Foreign Data Wrapper"
  type        = string
  default     = "false"
}

variable "auth_password_enabled" {
  description = "Habilitar autenticación por password"
  type        = string
  default     = "true"
}

variable "sign_in_prefilled" {
  description = "Pre-rellenar credenciales en el login"
  type        = string
  default     = "true"
}

variable "is_email_verification_required" {
  description = "Requerir verificación de email"
  type        = string
  default     = "false"
}

variable "auth_microsoft_enabled" {
  description = "Habilitar autenticación Microsoft OAuth"
  type        = string
  default     = "false"
}

variable "microsoft_tenant_id" {
  description = "Azure Tenant ID para Microsoft OAuth"
  type        = string
  default     = ""
}

variable "messaging_provider_microsoft_enabled" {
  description = "Habilitar sincronización de emails Microsoft"
  type        = string
  default     = "false"
}

variable "calendar_provider_microsoft_enabled" {
  description = "Habilitar sincronización de calendario Microsoft"
  type        = string
  default     = "false"
}

variable "email_driver" {
  description = "Driver de email (smtp)"
  type        = string
  default     = "smtp"
}

variable "email_from_address" {
  description = "Dirección de origen para emails"
  type        = string
}

variable "email_from_name" {
  description = "Nombre de origen para emails"
  type        = string
  default     = "CRM Symbiose"
}

variable "email_system_address" {
  description = "Dirección de email del sistema"
  type        = string
}

variable "email_smtp_host" {
  description = "Host SMTP"
  type        = string
  default     = "smtp.gmail.com"
}

variable "email_smtp_port" {
  description = "Puerto SMTP"
  type        = string
  default     = "587"
}

variable "email_smtp_user" {
  description = "Usuario SMTP"
  type        = string
}

variable "unipile_base_url" {
  description = "URL base de la API de Unipile"
  type        = string
  default     = "https://api37.unipile.com:16755"
}

variable "fullenrich_base_url" {
  description = "URL base de la API de FullEnrich"
  type        = string
  default     = "https://app.fullenrich.com/api/v2"
}
