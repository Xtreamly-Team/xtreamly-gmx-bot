# Variables for Xtreamly GMX Bot Infrastructure

variable "project_id" {
  description = "The GCP project ID where resources will be created"
  type        = string
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "function_name" {
  description = "Name of the cloud function"
  type        = string
  default     = "processGmxTradingSignal"
}

variable "topic_name" {
  description = "Name of the Pub/Sub topic for trading signals"
  type        = string
  default     = "trading-signals"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "bot_ids" {
  description = "List of bot IDs that need secrets created in Secret Manager"
  type        = list(string)
  default     = []
}

variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = ""
}

variable "function_memory" {
  description = "Memory allocation for the cloud function"
  type        = string
  default     = "512M"
  
  validation {
    condition     = contains(["256M", "512M", "1G", "2G", "4G", "8G"], var.function_memory)
    error_message = "Function memory must be one of: 256M, 512M, 1G, 2G, 4G, 8G."
  }
}

variable "function_timeout" {
  description = "Timeout for the cloud function in seconds"
  type        = number
  default     = 540
  
  validation {
    condition     = var.function_timeout >= 1 && var.function_timeout <= 540
    error_message = "Function timeout must be between 1 and 540 seconds."
  }
}

variable "max_instances" {
  description = "Maximum number of function instances"
  type        = number
  default     = 10
  
  validation {
    condition     = var.max_instances >= 1 && var.max_instances <= 1000
    error_message = "Max instances must be between 1 and 1000."
  }
}

variable "min_instances" {
  description = "Minimum number of function instances"
  type        = number
  default     = 0
  
  validation {
    condition     = var.min_instances >= 0 && var.min_instances <= var.max_instances
    error_message = "Min instances must be between 0 and max_instances."
  }
}

variable "enable_monitoring" {
  description = "Enable monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_vpc_connector" {
  description = "Enable VPC connector for private network access"
  type        = bool
  default     = false
}

variable "vpc_network" {
  description = "VPC network name for connector (if enabled)"
  type        = string
  default     = ""
}

variable "vpc_subnet" {
  description = "VPC subnet name for connector (if enabled)"
  type        = string
  default     = ""
}
