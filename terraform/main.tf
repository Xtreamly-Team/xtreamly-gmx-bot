# Xtreamly GMX Bot Infrastructure
# This Terraform configuration sets up the infrastructure for the GMX bot cloud function

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "function_name" {
  description = "Name of the cloud function"
  type        = string
  default     = "processGmxTradingSignal"
}

variable "topic_name" {
  description = "Name of the Pub/Sub topic"
  type        = string
  default     = "trading-signals"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudfunctions.googleapis.com",
    "pubsub.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
  ])

  service = each.value
  disable_on_destroy = false
}

# Pub/Sub Topic for trading signals
resource "google_pubsub_topic" "trading_signals" {
  name = var.topic_name
  depends_on = [google_project_service.required_apis]
}

# Pub/Sub Subscription (optional, for monitoring)
resource "google_pubsub_subscription" "trading_signals_subscription" {
  name  = "${var.topic_name}-subscription"
  topic = google_pubsub_topic.trading_signals.name

  # Retry policy
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # Message retention
  message_retention_duration = "600s"
}

# Service Account for Cloud Function
resource "google_service_account" "gmx_bot_function" {
  account_id   = "gmx-bot-function"
  display_name = "GMX Bot Cloud Function Service Account"
  description  = "Service account for GMX bot cloud function"
}

# IAM roles for the service account
resource "google_project_iam_member" "function_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.gmx_bot_function.email}"
}

resource "google_project_iam_member" "function_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.gmx_bot_function.email}"
}

resource "google_project_iam_member" "function_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.gmx_bot_function.email}"
}

resource "google_project_iam_member" "function_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gmx_bot_function.email}"
}

resource "google_project_iam_member" "function_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gmx_bot_function.email}"
}

# Cloud Function
resource "google_cloudfunctions2_function" "gmx_bot_function" {
  name     = var.function_name
  location = var.region
  depends_on = [
    google_project_service.required_apis,
    google_service_account.gmx_bot_function
  ]

  build_config {
    runtime     = "nodejs18"
    entry_point = "processPubsubMessage"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.function_source.name
      }
    }
  }

  service_config {
    max_instance_count    = 10
    min_instance_count    = 0
    available_memory      = "512M"
    timeout_seconds       = 540
    service_account_email = google_service_account.gmx_bot_function.email
    
    environment_variables = {
      GCP_PROJECT_ID = var.project_id
      ENVIRONMENT    = var.environment
    }

    # VPC connector if needed for database access
    # vpc_connector = google_vpc_access_connector.connector.name
    # vpc_connector_egress_settings = "PRIVATE_RANGES_ONLY"
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.trading_signals.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }
}

# Storage bucket for function source code
resource "google_storage_bucket" "function_source" {
  name          = "${var.project_id}-gmx-bot-function-source"
  location      = "US"
  force_destroy = true

  uniform_bucket_level_access = true
}

# Storage bucket object for function source
resource "google_storage_bucket_object" "function_source" {
  name   = "gmx-bot-function-source.zip"
  bucket = google_storage_bucket.function_source.name
  source = "../cloud-functions/dist/main.js"  # This will be created during build
}

# Secret Manager secrets (example - you'll need to create these manually or via separate script)
# Note: Actual secret values should be created manually for security
resource "google_secret_manager_secret" "bot_private_keys" {
  for_each = toset(var.bot_ids)

  secret_id = "bot-${each.value}-private-key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

# Monitoring and Alerting
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification Channel"
  type         = "email"
  
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_alert_policy" "function_errors" {
  display_name = "GMX Bot Function Errors"
  combiner     = "OR"
  
  conditions {
    display_name = "Function execution errors"
    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND resource.labels.function_name=\"${var.function_name}\""
      duration        = "60s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  
  notification_channels = [google_monitoring_notification_channel.email.name]
  
  alert_strategy {
    auto_close = "1800s"
  }
}

# Additional variables for secrets and monitoring
variable "bot_ids" {
  description = "List of bot IDs that need secrets created"
  type        = list(string)
  default     = []
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}
