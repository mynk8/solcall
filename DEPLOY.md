# Deploy SolCall on AWS

The script deploys the React site to Amplify and the Python API to ECS Express Mode.
S3 stores a private data snapshot for each release.
ECR stores the API image.

## Prerequisites

- AWS CLI v2 with the ECS Express commands and valid AWS credentials.
- Docker with a running daemon.
- Python 3.10 or newer.
- Node.js and pnpm.
- AWS permissions for S3, ECR, ECS, IAM, Amplify, and the default VPC.

The AWS identity must also have permission to pass the three IAM roles to ECS.
Express Mode uses its default infrastructure configuration for HTTPS and container logs.
On Windows, use Docker Desktop with Linux containers enabled.

## Deploy from PowerShell

From the repository root, preview the steps:

```powershell
.\deploy-aws.ps1 --plan
```

If your AWS session expired, authenticate:

```powershell
aws login
```

Deploy to Mumbai:

```powershell
.\deploy-aws.ps1 --region ap-south-1
```

For a named AWS profile, add `--profile hackathon`.
For a separate deployment, add `--name solcall-demo`.
The launcher finds Python through `py`, `python`, or `python3`.
It uses the same deployment code as the Bash launcher.

If Windows blocks script execution, use a policy override for this invocation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy-aws.ps1 --region ap-south-1
```

## Deploy from Bash

1. From the repository root, preview the steps:

   ```bash
   ./deploy-aws.sh --plan
   ```

2. If your AWS session expired, authenticate:

   ```bash
   aws login
   ```

3. Deploy to Mumbai:

   ```bash
   ./deploy-aws.sh --region ap-south-1
   ```

The script prints the website URL after the public checks pass.
It saves resource IDs and URLs in `.deploy/state.json`.
The script uploads the local frontend build directly to Amplify.
GitHub authorization is not necessary.

For a named AWS profile, use:

```bash
./deploy-aws.sh --profile hackathon --region ap-south-1
```

For a separate deployment, use a different resource prefix:

```bash
./deploy-aws.sh --name solcall-demo --region ap-south-1
```

## Update

Run the same command after changes to the code or data.
Keep the same account, region, and resource prefix.
The script reuses the bucket, roles, ECR repository, ECS service, and Amplify app.
Each deployment gets a unique image tag and S3 snapshot.

The default bucket name is `NAME-data-ACCOUNT-REGION`.
For a custom bucket in the same account and region, add `--bucket BUCKET_NAME`.
The script keeps that bucket private and enables versioning.

## Data and routing

The Docker build generates the feeds.
The script copies `data/` and `out/` from that image into one ZIP snapshot.
The API downloads this snapshot from S3 before it starts.
It checks the SHA-256 checksum before it imports the engine.
The task role has read access to `snapshots/*` in the data bucket.

Amplify proxies `/api/*` to the HTTPS API endpoint.
Its SPA rewrite supports direct visits to `/map`, `/check`, and `/deal`.
The public checks include static assets and API query parameters.

## Defaults

| Configuration | Value |
|---|---|
| Region | Mumbai, `ap-south-1` |
| ECS compute | 0.25 vCPU, 1 GB |
| ECS tasks | Minimum 1, maximum 1 |
| Container architecture | Linux AMD64 |
| Container port | 8000 |
| Health endpoint | `/health` |
| Amplify branch | `main` |
| Deployment timeout | 30 minutes per service |

The script uses the default VPC.
If no default VPC exists, the script creates one.
An existing default VPC must have public subnets in two availability zones.
The deployment uses an internet-facing load balancer.
AWS bills the underlying resources while they exist.

## Local checks

```bash
python3 -m unittest discover -s tests -p 'test_aws_deployment.py'
bash -n deploy-aws.sh
```

These checks do not contact AWS.
`--plan` also makes no AWS calls and performs no builds.

## AWS references

- [ECS Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html)
- [ECS CLI deployment](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html)
- [Amplify ZIP deployment](https://docs.aws.amazon.com/cli/latest/reference/amplify/create-deployment.html)
- [Amplify rewrites](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html)
