#!/bin/bash

# GMX Bot Cloud Function Deployment Script
# This script deploys the GMX bot as a Google Cloud Function with Pub/Sub trigger

set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"your-gcp-project-id"}
FUNCTION_NAME="processGmxTradingSignal"
TOPIC_NAME="trading-signals"
REGION="us-central1"
RUNTIME="nodejs18"

echo "🚀 Deploying GMX Bot Cloud Function..."
echo "Project ID: $PROJECT_ID"
echo "Function Name: $FUNCTION_NAME"
echo "Topic Name: $TOPIC_NAME"
echo "Region: $REGION"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run 'gcloud auth login' first."
    exit 1
fi

# Set the project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Create Pub/Sub topic if it doesn't exist
echo "📡 Creating Pub/Sub topic if it doesn't exist..."
gcloud pubsub topics create $TOPIC_NAME --project=$PROJECT_ID 2>/dev/null || echo "Topic already exists"

# Build the TypeScript code
echo "🔨 Building TypeScript code..."
npm install
npm run build

# Deploy the Cloud Function
echo "☁️ Deploying Cloud Function..."
gcloud functions deploy $FUNCTION_NAME \
    --runtime=$RUNTIME \
    --trigger-topic=$TOPIC_NAME \
    --source=. \
    --entry-point=processPubsubMessage \
    --region=$REGION \
    --project=$PROJECT_ID \
    --memory=512MB \
    --timeout=540s \
    --max-instances=10 \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID" \
    --allow-unauthenticated

echo "✅ GMX Bot Cloud Function deployed successfully!"
echo ""
echo "📊 Function Details:"
echo "  - Function Name: $FUNCTION_NAME"
echo "  - Trigger: Pub/Sub topic '$TOPIC_NAME'"
echo "  - Region: $REGION"
echo "  - Runtime: $RUNTIME"
echo ""
echo "🔧 Next Steps:"
echo "  1. Set up environment variables in Google Cloud Console"
echo "  2. Create secrets in Google Secret Manager for bot private keys"
echo "  3. Configure your bot service to publish messages to the '$TOPIC_NAME' topic"
echo "  4. Test the function by publishing a test message"
echo ""
echo "🧪 Test the function:"
echo "  gcloud pubsub topics publish $TOPIC_NAME --message='{\"type\":\"trading_signal\",\"signals\":[{\"symbol\":\"ETH\",\"signal_long\":true,\"signal_short\":false,\"horizon\":240}]}'"
