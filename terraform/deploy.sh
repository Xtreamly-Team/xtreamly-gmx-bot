#!/bin/bash

# Terraform deployment script for Xtreamly GMX Bot Infrastructure
# This script deploys the complete infrastructure for the GMX bot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID=${GCP_PROJECT_ID:-""}
REGION=${GCP_REGION:-"us-central1"}

echo -e "${BLUE}🚀 Xtreamly GMX Bot Infrastructure Deployment${NC}"
echo "=================================================="

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Not authenticated with gcloud. Please run 'gcloud auth login' first.${NC}"
    exit 1
fi

# Get project ID if not set
if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$PROJECT_ID" ]; then
        echo -e "${YELLOW}⚠️  No project ID set. Please set GCP_PROJECT_ID environment variable or run 'gcloud config set project YOUR_PROJECT_ID'${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}📋 Using project: $PROJECT_ID${NC}"
echo -e "${GREEN}📋 Using region: $REGION${NC}"

# Set the project
echo -e "${BLUE}🔧 Setting project...${NC}"
gcloud config set project $PROJECT_ID

# Check if terraform.tfvars exists
if [ ! -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    echo -e "${YELLOW}⚠️  terraform.tfvars not found. Creating from example...${NC}"
    if [ -f "$TERRAFORM_DIR/terraform.tfvars.example" ]; then
        cp "$TERRAFORM_DIR/terraform.tfvars.example" "$TERRAFORM_DIR/terraform.tfvars"
        echo -e "${YELLOW}📝 Please edit terraform.tfvars with your values before continuing.${NC}"
        echo -e "${YELLOW}   At minimum, update the project_id variable.${NC}"
        read -p "Press Enter to continue after editing terraform.tfvars..."
    else
        echo -e "${RED}❌ terraform.tfvars.example not found. Please create terraform.tfvars manually.${NC}"
        exit 1
    fi
fi

# Navigate to terraform directory
cd "$TERRAFORM_DIR"

# Initialize Terraform
echo -e "${BLUE}🔧 Initializing Terraform...${NC}"
terraform init

# Validate Terraform configuration
echo -e "${BLUE}🔍 Validating Terraform configuration...${NC}"
terraform validate

# Plan the deployment
echo -e "${BLUE}📋 Planning Terraform deployment...${NC}"
terraform plan -out=tfplan

# Ask for confirmation
echo -e "${YELLOW}⚠️  Review the plan above. This will create/modify resources in project: $PROJECT_ID${NC}"
read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Deployment cancelled.${NC}"
    exit 1
fi

# Apply the deployment
echo -e "${BLUE}🚀 Deploying infrastructure...${NC}"
terraform apply tfplan

# Clean up plan file
rm -f tfplan

# Display outputs
echo -e "${GREEN}✅ Infrastructure deployed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo "========================"
terraform output

echo ""
echo -e "${BLUE}🔧 Next Steps:${NC}"
echo "=============="
echo "1. Set environment variables in Google Cloud Console for the function"
echo "2. Create actual secret values in Secret Manager for bot private keys:"
echo "   gcloud secrets create bot-{BOT_ID}-private-key --data-file=- <<< 'your-private-key'"
echo "3. Configure your bot service to publish messages to the Pub/Sub topic"
echo "4. Test the function with a sample message"
echo "5. Monitor function execution and bot events"

echo ""
echo -e "${BLUE}🧪 Test Commands:${NC}"
echo "=================="
echo "# Test the function:"
echo "gcloud pubsub topics publish trading-signals --message='{\"type\":\"trading_signal\",\"signals\":[{\"symbol\":\"ETH\",\"signal_long\":true,\"signal_short\":false,\"horizon\":240}]}'"
echo ""
echo "# View function logs:"
echo "gcloud functions logs read processGmxTradingSignal --region=$REGION"

echo ""
echo -e "${GREEN}🎉 GMX Bot infrastructure is ready!${NC}"
