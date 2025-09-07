# Outputs for Xtreamly GMX Bot Infrastructure

output "project_id" {
  description = "The GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "The GCP region"
  value       = var.region
}

output "function_name" {
  description = "Name of the deployed cloud function"
  value       = google_cloudfunctions2_function.gmx_bot_function.name
}

output "function_url" {
  description = "URL of the deployed cloud function"
  value       = google_cloudfunctions2_function.gmx_bot_function.url
}

output "pubsub_topic_name" {
  description = "Name of the Pub/Sub topic"
  value       = google_pubsub_topic.trading_signals.name
}

output "pubsub_topic_id" {
  description = "ID of the Pub/Sub topic"
  value       = google_pubsub_topic.trading_signals.id
}

output "service_account_email" {
  description = "Email of the service account used by the function"
  value       = google_service_account.gmx_bot_function.email
}

output "secret_names" {
  description = "Names of created secrets in Secret Manager"
  value       = [for secret in google_secret_manager_secret.bot_private_keys : secret.name]
}

output "monitoring_alert_policy" {
  description = "Name of the monitoring alert policy"
  value       = var.enable_monitoring ? google_monitoring_alert_policy.function_errors[0].name : null
}

output "deployment_commands" {
  description = "Commands to test and interact with the deployed function"
  value = {
    test_message = "gcloud pubsub topics publish ${google_pubsub_topic.trading_signals.name} --message='{\"type\":\"trading_signal\",\"signals\":[{\"symbol\":\"ETH\",\"signal_long\":true,\"signal_short\":false,\"horizon\":240}]}'"
    view_logs    = "gcloud functions logs read ${google_cloudfunctions2_function.gmx_bot_function.name} --region=${var.region}"
    function_url = google_cloudfunctions2_function.gmx_bot_function.url
  }
}

output "next_steps" {
  description = "Next steps to complete the setup"
  value = {
    step_1 = "Set environment variables in Google Cloud Console for the function"
    step_2 = "Create actual secret values in Secret Manager for bot private keys"
    step_3 = "Configure your bot service to publish messages to the Pub/Sub topic"
    step_4 = "Test the function with a sample message"
    step_5 = "Monitor function execution and bot events"
  }
}
