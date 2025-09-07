# Xtreamly GMX Bot Infrastructure

This Terraform configuration sets up the complete infrastructure for the Xtreamly GMX Bot cloud function deployment.

## Architecture

The infrastructure includes:

- **Cloud Function**: Event-driven function triggered by Pub/Sub messages
- **Pub/Sub Topic**: For receiving trading signals
- **Secret Manager**: For storing bot private keys securely
- **Service Account**: With appropriate IAM permissions
- **Monitoring**: Alert policies for function errors
- **Storage**: Bucket for function source code

## Prerequisites

- Google Cloud Project with billing enabled
- `gcloud` CLI installed and authenticated
- `terraform` CLI installed (>= 1.0)
- Appropriate permissions to create resources

## Quick Start

### 1. Configure Variables

```bash
# Copy the example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

Required variables:
- `project_id`: Your Google Cloud Project ID
- `bot_ids`: List of bot IDs that need secrets
- `alert_email`: Email for monitoring alerts

### 2. Deploy Infrastructure

```bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy everything
./deploy.sh
```

### 3. Manual Steps

After deployment, you need to:

1. **Set Environment Variables** in Google Cloud Console:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`
   - `BOT_SERVICE_BASE_URL`, `BOT_SERVICE_API_KEY`
   - `ARB_RPC_URL`

2. **Create Secret Values**:
   ```bash
   # For each bot ID
   gcloud secrets create bot-{BOT_ID}-private-key --data-file=- <<< "your-private-key-here"
   ```

3. **Deploy Function Code**:
   ```bash
   cd ../cloud-functions
   ./deploy.sh
   ```

## Configuration

### Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `project_id` | GCP Project ID | - | ✅ |
| `region` | GCP Region | `us-central1` | ❌ |
| `function_name` | Cloud Function name | `processGmxTradingSignal` | ❌ |
| `topic_name` | Pub/Sub topic name | `trading-signals` | ❌ |
| `bot_ids` | List of bot IDs | `[]` | ❌ |
| `alert_email` | Email for alerts | `""` | ❌ |

### Environment-Specific Deployments

For different environments, use different variable files:

```bash
# Development
terraform apply -var-file="dev.tfvars"

# Staging
terraform apply -var-file="staging.tfvars"

# Production
terraform apply -var-file="prod.tfvars"
```

## Resources Created

### Core Infrastructure
- `google_pubsub_topic.trading_signals` - Pub/Sub topic for signals
- `google_cloudfunctions2_function.gmx_bot_function` - Main cloud function
- `google_service_account.gmx_bot_function` - Service account

### Security
- `google_secret_manager_secret.bot_private_keys` - Secrets for bot keys
- IAM roles for service account

### Monitoring
- `google_monitoring_alert_policy.function_errors` - Error alerts
- `google_monitoring_notification_channel.email` - Email notifications

### Storage
- `google_storage_bucket.function_source` - Function source code bucket

## Testing

### Test the Function

```bash
# Publish a test message
gcloud pubsub topics publish trading-signals \
  --message='{"type":"trading_signal","signals":[{"symbol":"ETH","signal_long":true,"signal_short":false,"horizon":240}]}'
```

### View Logs

```bash
# Function logs
gcloud functions logs read processGmxTradingSignal --region=us-central1

# Pub/Sub logs
gcloud logging read "resource.type=pubsub_topic" --limit=50
```

## Monitoring

### Key Metrics
- Function execution count
- Function error rate
- Function duration
- Pub/Sub message processing

### Alerts
- Function execution errors
- High error rates
- Function timeouts

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure service account has required roles
   - Check IAM bindings

2. **Function Not Triggering**
   - Verify Pub/Sub topic exists
   - Check function event trigger configuration

3. **Secret Access Errors**
   - Verify secrets exist in Secret Manager
   - Check service account has `secretmanager.secretAccessor` role

### Useful Commands

```bash
# Check function status
gcloud functions describe processGmxTradingSignal --region=us-central1

# List secrets
gcloud secrets list

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:gmx-bot-function@$PROJECT_ID.iam.gserviceaccount.com"
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all resources including secrets. Make sure to backup any important data first.

## Security Considerations

- Private keys are stored in Secret Manager (encrypted at rest)
- Service account follows principle of least privilege
- Function runs in isolated environment
- Network access can be restricted with VPC connector

## Cost Optimization

- Function scales to zero when not in use
- Pub/Sub has pay-per-use pricing
- Secret Manager charges per secret version
- Monitoring has free tier limits
