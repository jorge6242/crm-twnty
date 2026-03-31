terraform {
  cloud {
    organization = "jgomezdev"
    workspaces {
      name = "crm-railway-production"
    }
  }

  required_providers {
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.4.0"
    }
  }
}

provider "railway" {
  # Token leído desde la variable de entorno RAILWAY_TOKEN
  # En CI/CD: configurado como variable en Terraform Cloud
  # En local: export RAILWAY_TOKEN="..."
}
