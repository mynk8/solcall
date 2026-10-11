
#!/usr/bin/env bash
# ==============================================================================
# SolCall - AWS ECS Deployment Script (via Docker & Amazon ECR)
# ==============================================================================
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
ECR_REPO_NAME="${ECR_REPO_NAME:-solcall-engine}"
ECS_CLUSTER="${ECS_CLUSTER:-solcall-cluster}"
ECS_SERVICE="${ECS_SERVICE:-solcall-service}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "Error: AWS_ACCOUNT_ID environment variable is required."
  echo "Usage: AWS_ACCOUNT_ID=123456789012 ./deploy-ecs.sh"
  exit 1
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "============================================================"
echo "Deploying SolCall Layer 3 Engine to AWS ECS Fargate"
echo "Region:     ${AWS_REGION}"
echo "ECR Repo:   ${ECR_URI}"
echo "ECS Target: ${ECS_CLUSTER} / ${ECS_SERVICE}"
echo "============================================================"

# Step 1: Ensure ECR repository exists
echo "-> Checking/Creating Amazon ECR repository: ${ECR_REPO_NAME}..."
aws ecr describe-repositories --repository-names "${ECR_REPO_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1 || \
aws ecr create-repository --repository-name "${ECR_REPO_NAME}" --region "${AWS_REGION}"

# Step 2: Authenticate Docker to Amazon ECR
echo "-> Authenticating Docker client to Amazon ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Step 3: Build Docker Image
echo "-> Building production Docker image for Layer 3..."
docker build -t "${ECR_REPO_NAME}:${IMAGE_TAG}" -f Dockerfile .

# Step 4: Tag Image for ECR
echo "-> Tagging Docker image for ECR..."
docker tag "${ECR_REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"

# Step 5: Push Image to Amazon ECR
echo "-> Pushing Docker image to Amazon ECR: ${ECR_URI}:${IMAGE_TAG}..."
docker push "${ECR_URI}:${IMAGE_TAG}"

# Step 6: Deploy/Update AWS ECS Fargate Service
echo "-> Updating AWS ECS Service to deploy new image version..."
aws ecs update-service \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --force-new-deployment \
  --region "${AWS_REGION}"

echo "============================================================"
echo "✓ Successfully deployed SolCall to AWS ECS Fargate!"
echo "============================================================"
