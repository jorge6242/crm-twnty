output "api_service_id" {
  description = "ID del servicio CRM — copiar a GitHub Secret RAILWAY_API_SERVICE_ID"
  value       = railway_service.crm_api.id
}

output "worker_service_id" {
  description = "ID del servicio Worker — copiar a GitHub Secret RAILWAY_WORKER_SERVICE_ID"
  value       = railway_service.crm_worker.id
}

output "project_id" {
  description = "ID del proyecto Railway"
  value       = local.project_id
}

output "app_url" {
  description = "URL pública del CRM"
  value       = "https://${var.public_domain}"
}
