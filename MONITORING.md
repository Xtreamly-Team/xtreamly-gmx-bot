"""
Monitoring documentation for xtreamly-gmx-bot.
"""

# Xtreamly GMX Bot - GCP Monitoring Setup

This document describes the monitoring and observability features for the GMX Bot, which runs on Google Cloud Run.

## 1. Structured Logging

- **Integration**: The service uses `winston` with `@google-cloud/logging-winston` for structured JSON logging.
- **How it Works**: The Winston logger is configured to use the Google Cloud transport in production, which sends structured logs to standard output. Cloud Run automatically ingests these logs.

### Viewing Logs
Find logs in the Google Cloud Console under `Logging > Logs Explorer` with the query:
```
resource.type="cloud_run_revision"
resource.labels.service_name="xtreamly-gmx-bot"
```

## 2. Custom Metrics

The service sends the following custom metrics to Google Cloud Monitoring:

- **Request Latency**: `custom.googleapis.com/xtreamly/api/request_latency_ms`
  - **Description**: Latency for each API request in milliseconds.
  - **Labels**: `http_method`, `path`, `status_code`.

- **Error Count**: `custom.googleapis.com/xtreamly/api/error_count`
  - **Description**: Counter for failed API requests (status code >= 400).
  - **Labels**: `http_method`, `path`, `status_code`.

- **Strategy Run Duration**: `custom.googleapis.com/xtreamly/strategy/duration_ms`
  - **Description**: The execution time of the perpetual trading strategy.
  - **Labels**: `status` (e.g., "success", "error").

- **Strategy Run Count**: `custom.googleapis.com/xtreamly/strategy/run_count`
  - **Description**: A count of strategy executions.
  - **Labels**: `status`.

### Viewing Metrics
View metrics in `Monitoring > Metrics Explorer`. Use the `Cloud Run Revision` resource type and search for metrics starting with `custom.googleapis.com/xtreamly/`.
