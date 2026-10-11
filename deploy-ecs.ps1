<#
.SYNOPSIS
    Automated PowerShell script to build, push to Amazon ECR, and deploy to AWS ECS Fargate.
.DESCRIPTION
    Builds the SolCall Layer 3 Docker container, logs into ECR, pushes the image, and updates the ECS service.
.EXAMPLE
    .\deploy-ecs.ps1 -AwsAccountId "123456789012" -AwsRegion "ap-south-1"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$AwsAccountId,

    [Parameter(Mandatory=$false)]
    [string]$AwsRegion = "ap-south-1",

    [Parameter(Mandatory=$false)]
    [string]$EcrRepoName = "solcall-engine",

    [Parameter(Mandatory=$false)]
    [string]$EcsCluster = "solcall-cluster",

    [Parameter(Mandatory=$false)]
    [string]$EcsService = "solcall-service",

    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

$EcrUri = "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com/$EcrRepoName"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Deploying SolCall Layer 3 Engine to AWS ECS Fargate" -ForegroundColor Cyan
Write-Host "AWS Region:   $AwsRegion"
Write-Host "ECR Repo:     $EcrUri"
Write-Host "ECS Cluster:  $EcsCluster"
Write-Host "ECS Service:  $EcsService"
Write-Host "============================================================"

# Step 1: Check / Create ECR Repo
Write-Host "-> Ensuring Amazon ECR repository exists..." -ForegroundColor Yellow
try {
    aws ecr describe-repositories --repository-names $EcrRepoName --region $AwsRegion | Out-Null
} catch {
    Write-Host "   Creating ECR repo $EcrRepoName..." -ForegroundColor Gray
    aws ecr create-repository --repository-name $EcrRepoName --region $AwsRegion | Out-Null
}

# Step 2: Authenticate Docker to ECR
Write-Host "-> Authenticating Docker to Amazon ECR..." -ForegroundColor Yellow
$loginPassword = aws ecr get-login-password --region $AwsRegion
$loginPassword | docker login --username AWS --password-stdin "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com"

# Step 3: Build Docker Image
Write-Host "-> Building production Docker image for Layer 3..." -ForegroundColor Yellow
docker build -t "$EcrRepoName`:$ImageTag" -f Dockerfile .

# Step 4: Tag Docker Image
Write-Host "-> Tagging Docker image for ECR..." -ForegroundColor Yellow
docker tag "$EcrRepoName`:$ImageTag" "$EcrUri`:$ImageTag"

# Step 5: Push Image to ECR
Write-Host "-> Pushing Docker image to Amazon ECR: $EcrUri`:$ImageTag..." -ForegroundColor Yellow
docker push "$EcrUri`:$ImageTag"

# Step 6: Trigger AWS ECS Service update
Write-Host "-> Triggering AWS ECS Service new deployment..." -ForegroundColor Yellow
aws ecs update-service --cluster $EcsCluster --service $EcsService --force-new-deployment --region $AwsRegion

Write-Host "============================================================" -ForegroundColor Green
Write-Host "✓ Successfully pushed image to ECR and deployed to AWS ECS!" -ForegroundColor Green
Write-Host "============================================================"
