#!/usr/bin/env python3
"""Deploy SolCall with the AWS CLI, Docker, and a local frontend build."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPA_SOURCE = r"</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>"


class AwsError(RuntimeError):
    def __init__(self, message: str):
        super().__init__(message)
        match = re.search(r"\(([^)]+)\) when calling", message)
        self.code = match.group(1) if match else ""


class Aws:
    def __init__(self, region: str, profile: str | None):
        self.base = ["aws", "--region", region, "--no-cli-pager", "--no-cli-auto-prompt"]
        if profile:
            self.base += ["--profile", profile]

    def call(self, service: str, operation: str, payload=None, *, extra=(), raw=False):
        command = self.base + [service, operation, "--output", "text" if raw else "json"]
        if payload:
            command += ["--cli-input-json", json.dumps(payload)]
        result = subprocess.run(command + list(extra), capture_output=True, text=True)
        if result.returncode:
            raise AwsError(result.stderr.strip())
        return result.stdout.strip() if raw else json.loads(result.stdout or "{}")

    def optional(self, service: str, operation: str, payload, missing: set[str]):
        try:
            return self.call(service, operation, payload)
        except AwsError as error:
            if error.code not in missing:
                raise
            return None


def run(command: list[str], *, cwd=ROOT, capture=False, stdin=None) -> str:
    # Resolve Windows launchers such as pnpm.cmd before calling CreateProcess.
    executable = shutil.which(command[0])
    if executable is None:
        raise RuntimeError(f"Install {command[0]} before deployment.")
    command = [executable, *command[1:]]
    result = subprocess.run(command, cwd=cwd, input=stdin, text=True, capture_output=capture)
    if result.returncode:
        raise RuntimeError(f"{command[0]} {command[1]} failed (exit {result.returncode}).")
    return (result.stdout or "").strip()


def zip_directory(source: Path, target: Path) -> None:
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source).as_posix())


def build_release(name: str, release: str, directory: Path) -> tuple[str, Path, Path]:
    print("1/6 Build the frontend and API image.", flush=True)
    run(["pnpm", "install", "--frozen-lockfile"], cwd=ROOT / "web")
    run(["pnpm", "build"], cwd=ROOT / "web")
    frontend = directory / "frontend.zip"
    if not (ROOT / "web/dist/index.html").is_file():
        raise RuntimeError("The frontend build did not create web/dist/index.html.")
    zip_directory(ROOT / "web/dist", frontend)
    image = f"{name}-api:{release}"
    run(["docker", "build", "--platform", "linux/amd64", "-t", image, "."])
    # Copy both inputs and generated feeds from the SAME image.
    snapshot_root = directory / "snapshot"
    snapshot_root.mkdir()
    container = run(["docker", "create", image], capture=True)
    try:
        for folder in ("data", "out"):
            destination = snapshot_root / folder
            destination.mkdir()
            run(["docker", "cp", f"{container}:/app/{folder}/.", str(destination)])
    finally:
        run(["docker", "rm", container], capture=True)
    snapshot = directory / "data.zip"
    zip_directory(snapshot_root, snapshot)
    return image, frontend, snapshot


def ensure_bucket(aws: Aws, bucket: str, region: str, account: str) -> None:
    found = aws.optional("s3api", "head-bucket", {"Bucket": bucket, "ExpectedBucketOwner": account},
                         {"404", "NoSuchBucket", "NotFound"})
    if found is None:
        request = {"Bucket": bucket}
        if region != "us-east-1":
            request["CreateBucketConfiguration"] = {"LocationConstraint": region}
        aws.call("s3api", "create-bucket", request)
    owner = {"Bucket": bucket, "ExpectedBucketOwner": account}
    aws.call("s3api", "put-public-access-block", {
        **owner, "PublicAccessBlockConfiguration": {
            "BlockPublicAcls": True, "IgnorePublicAcls": True,
            "BlockPublicPolicy": True, "RestrictPublicBuckets": True,
        },
    })
    aws.call("s3api", "put-bucket-versioning", {**owner, "VersioningConfiguration": {"Status": "Enabled"}})
    aws.call("s3api", "put-bucket-encryption", {
        **owner, "ServerSideEncryptionConfiguration": {
            "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}],
        },
    })


def ensure_role(aws: Aws, name: str, principal: str, account: str, policy_arn=None) -> str:
    trust = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow", "Principal": {"Service": principal},
            "Action": "sts:AssumeRole", "Condition": {"StringEquals": {"aws:SourceAccount": account}},
        }],
    }
    if principal == "ecs.amazonaws.com":
        # Use AWS's infrastructure-role trust policy.
        trust["Statement"][0].pop("Condition")
    role = aws.optional("iam", "get-role", {"RoleName": name}, {"NoSuchEntity"})
    if role is None:
        role = aws.call("iam", "create-role", {
            "RoleName": name, "AssumeRolePolicyDocument": json.dumps(trust),
        })
    else:
        aws.call("iam", "update-assume-role-policy", {
            "RoleName": name, "PolicyDocument": json.dumps(trust),
        })
    if policy_arn:
        aws.call("iam", "attach-role-policy", {"RoleName": name, "PolicyArn": policy_arn})
    return role["Role"]["Arn"]


def ensure_roles(aws: Aws, name: str, bucket: str, account: str, partition: str) -> tuple[str, str, str]:
    execution = ensure_role(
        aws, f"{name}-execution", "ecs-tasks.amazonaws.com", account,
        f"arn:{partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    )
    infrastructure = ensure_role(
        aws, f"{name}-infrastructure", "ecs.amazonaws.com", account,
        f"arn:{partition}:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices",
    )
    task = ensure_role(aws, f"{name}-data", "ecs-tasks.amazonaws.com", account)
    aws.call("iam", "put-role-policy", {
        "RoleName": f"{name}-data", "PolicyName": "ReadSolCallSnapshot",
        "PolicyDocument": json.dumps({
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow", "Action": "s3:GetObject",
                "Resource": f"arn:{partition}:s3:::{bucket}/snapshots/*",
            }],
        }),
    })
    return execution, infrastructure, task


def push_image(aws: Aws, name: str, image: str, release: str) -> str:
    print("3/6 Push the API image to ECR.", flush=True)
    repository = f"{name}-api"
    response = aws.optional("ecr", "describe-repositories", {"repositoryNames": [repository]},
                            {"RepositoryNotFoundException"})
    if response is None:
        repo = aws.call("ecr", "create-repository", {
            "repositoryName": repository, "imageTagMutability": "IMMUTABLE",
        })["repository"]
    else:
        repo = response["repositories"][0]
    uri = repo["repositoryUri"]
    password = aws.call("ecr", "get-login-password", raw=True)
    run(["docker", "login", "--username", "AWS", "--password-stdin", uri.split("/")[0]],
        stdin=password + "\n", capture=True)
    remote_image = f"{uri}:{release}"
    run(["docker", "tag", image, remote_image])
    run(["docker", "push", remote_image])
    return remote_image


def ensure_network_and_cluster(aws: Aws, name: str) -> None:
    vpcs = aws.call("ec2", "describe-vpcs", {"Filters": [{"Name": "is-default", "Values": ["true"]}]})["Vpcs"]
    if not vpcs:
        vpcs = [aws.call("ec2", "create-default-vpc")["Vpc"]]
    subnets = aws.call("ec2", "describe-subnets", {
        "Filters": [{"Name": "vpc-id", "Values": [vpcs[0]["VpcId"]]}],
    })["Subnets"]
    available_zones = {s["AvailabilityZone"] for s in subnets if s["State"] == "available"}
    if len(available_zones) < 2:
        raise RuntimeError("ECS Express needs public subnets in two zones in the default VPC.")
    clusters = aws.call("ecs", "describe-clusters", {"clusters": [name]})["clusters"]
    if not clusters or clusters[0]["status"] == "INACTIVE":
        aws.call("ecs", "create-cluster", {"clusterName": name})


def deploy_api(aws: Aws, args, image: str, release: str, bucket: str, key: str,
               digest: str, roles: tuple[str, str, str]) -> str:
    print("4/6 Create or update the ECS Express API.", flush=True)
    ensure_network_and_cluster(aws, args.name)
    execution, infrastructure, task = roles
    service_name = f"{args.name}-api"
    services = aws.call("ecs", "list-services", {"cluster": args.name})["serviceArns"]
    service_arn = next((arn for arn in services if arn.endswith("/" + service_name)), None)
    request = {
        "executionRoleArn": execution, "taskRoleArn": task, "healthCheckPath": "/health",
        "cpu": "256", "memory": "1024",
        "scalingTarget": {
            "minTaskCount": 1, "maxTaskCount": 1,
            "autoScalingMetric": "AVERAGE_CPU", "autoScalingTargetValue": 60,
        },
        "primaryContainer": {
            "image": image, "containerPort": 8000,
            "environment": [
                {"name": "AWS_DEFAULT_REGION", "value": args.region},
                {"name": "SOLCALL_DATA_BUCKET", "value": bucket},
                {"name": "SOLCALL_DATA_KEY", "value": key},
                {"name": "SOLCALL_DATA_SHA256", "value": digest},
                {"name": "SOLCALL_RELEASE", "value": release},
            ],
        },
    }
    if service_arn:
        # Refuse an ordinary ECS service with a colliding name.
        aws.call("ecs", "describe-express-gateway-service", {"serviceArn": service_arn})
        operation = "update-express-gateway-service"
        request["serviceArn"] = service_arn
    else:
        operation = "create-express-gateway-service"
        request.update(serviceName=service_name, cluster=args.name, infrastructureRoleArn=infrastructure)
    for attempt in range(12):
        try:
            response = aws.call("ecs", operation, request)
            return response["service"]["serviceArn"]
        except AwsError as error:
            # Newly created IAM roles can take a minute to propagate.
            if attempt == 11 or not re.search(r"assum|propagat", str(error), re.IGNORECASE):
                raise
            time.sleep(5)
    raise RuntimeError("ECS did not accept the deployment.")


def fetch(url: str) -> bytes:
    with urlopen(Request(url, headers={"Cache-Control": "no-cache"}), timeout=15) as response:
        return response.read()


def fetch_json(url: str):
    return json.loads(fetch(url))


def wait_api(aws: Aws, args, service_arn: str, image: str, release: str) -> str:
    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        service = aws.call("ecs", "describe-express-gateway-service", {"serviceArn": service_arn})["service"]
        if service["status"]["statusCode"] in {"INACTIVE", "DRAINING"}:
            raise RuntimeError(f"ECS stopped: {service['status'].get('statusReason', '')}")
        configs = [c for c in service.get("activeConfigurations", []) if c["primaryContainer"]["image"] == image]
        ecs_service = aws.call("ecs", "describe-services", {
            "cluster": args.name, "services": [service_arn],
        })["services"]
        ordinary = ecs_service[0] if ecs_service else {}
        deployments = ordinary.get("deployments", [])
        primary = next((d for d in deployments if d.get("status") == "PRIMARY"), {})
        if primary.get("rolloutState") == "FAILED":
            raise RuntimeError(f"ECS deployment failed: {primary.get('rolloutStateReason', '')}")
        stable = (
            primary.get("rolloutState") == "COMPLETED"
            or (len(deployments) == 1 and ordinary.get("runningCount", 0) > 0
                and ordinary.get("runningCount") == ordinary.get("desiredCount")
                and ordinary.get("pendingCount", 0) == 0)
        )
        for config in configs:
            if (primary.get("taskDefinition") != config.get("taskDefinitionArn")
                    or not stable):
                continue
            for ingress in config.get("ingressPaths", []):
                if ingress["accessType"] != "PUBLIC":
                    continue
                endpoint = ingress["endpoint"].rstrip("/")
                if not endpoint.startswith("https://"):
                    endpoint = "https://" + endpoint
                try:
                    if fetch_json(endpoint + "/health").get("release") == release:
                        fetch_json(endpoint + "/api/web/prices")["sizes"]
                        return endpoint
                except (URLError, ValueError, KeyError, TimeoutError):
                    pass
        time.sleep(10)
    raise RuntimeError("ECS did not become healthy before the timeout. Rerun the script after correcting the deployment.")


def deploy_frontend(aws: Aws, args, endpoint: str, archive: Path) -> tuple[str, str]:
    print("5/6 Upload the frontend to Amplify.", flush=True)
    app_name = f"{args.name}-web"
    matches = [app for app in aws.call("amplify", "list-apps")["apps"] if app["name"] == app_name]
    if len(matches) > 1:
        raise RuntimeError(f"Multiple Amplify apps use the name {app_name}. Give --name a unique value.")
    if matches:
        app = matches[0]
        if app.get("repository") or app["platform"] != "WEB":
            raise RuntimeError(f"{app_name} already exists with a different deployment method. Use a different --name.")
    else:
        app = aws.call("amplify", "create-app", {"name": app_name, "platform": "WEB"})["app"]
    app_id = app["appId"]
    aws.call("amplify", "update-app", {
        "appId": app_id,
        "customRules": [
            {"source": "/api/<*>", "target": endpoint + "/api/<*>", "status": "200"},
            {"source": SPA_SOURCE, "target": "/index.html", "status": "200"},
        ],
        "customHeaders": "customHeaders:\n  - pattern: '/api/**'\n    headers:\n      - key: Cache-Control\n        value: no-store\n",
    })
    branches = aws.call("amplify", "list-branches", {"appId": app_id})["branches"]
    if not any(branch["branchName"] == "main" for branch in branches):
        aws.call("amplify", "create-branch", {
            "appId": app_id, "branchName": "main", "stage": "PRODUCTION", "enableAutoBuild": False,
        })
    job = aws.call("amplify", "create-deployment", {"appId": app_id, "branchName": "main"})
    # The upload URL contains temporary credentials. Never print or save it.
    with urlopen(Request(job["zipUploadUrl"], data=archive.read_bytes(), method="PUT",
                         headers={"Content-Type": "application/zip"}), timeout=120):
        pass
    aws.call("amplify", "start-deployment", {"appId": app_id, "branchName": "main", "jobId": job["jobId"]})
    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        status = aws.call("amplify", "get-job", {
            "appId": app_id, "branchName": "main", "jobId": job["jobId"],
        })["job"]["summary"]["status"]
        if status == "SUCCEED":
            return app_id, f"https://main.{app['defaultDomain']}"
        if status in {"FAILED", "CANCELLED"}:
            raise RuntimeError(f"Amplify deployment {job['jobId']} ended with {status}.")
        time.sleep(10)
    raise RuntimeError("Amplify did not finish before the timeout.")


def smoke_test(site: str, timeout: int) -> None:
    print("6/6 Check the public website, routes, and API proxy.", flush=True)
    deadline = time.monotonic() + timeout
    last_error = ""
    while time.monotonic() < deadline:
        try:
            html = fetch(site + "/").decode()
            if 'id="root"' not in html:
                raise ValueError("Amplify did not serve the React entry page.")
            for route in ("/map", "/check", "/deal"):
                if 'id="root"' not in fetch(site + route).decode():
                    raise ValueError(f"The SPA rewrite did not serve {route}.")
            asset = re.search(r'src="(/assets/[^"]+\.js)"', html)
            if not asset or fetch(site + asset.group(1)).lstrip().startswith(b"<"):
                raise ValueError("Amplify did not serve the JavaScript asset.")
            fetch_json(site + "/api/web/prices")["sizes"]
            for units in (450, 200):
                answer = fetch_json(site + f"/api/web/answer?units={units}&load=3&size=3&quote=240000")
                expected = {"units": units, "load": 3, "size": 3, "quote": 240000}
                if any(answer["inputs"].get(key) != value for key, value in expected.items()):
                    raise ValueError("The API proxy did not preserve the query parameters.")
            return
        except (URLError, ValueError, KeyError, TimeoutError) as error:
            last_error = str(error)
            time.sleep(10)
    raise RuntimeError(f"The public site did not pass its checks: {last_error}")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")))
    parser.add_argument("--profile", help="AWS CLI profile to use.")
    parser.add_argument("--name", default="solcall", help="Resource prefix. Reuse it for later deployments.")
    parser.add_argument("--bucket", help="Data bucket. Default: NAME-data-ACCOUNT-REGION.")
    parser.add_argument("--timeout", type=int, default=1800, help="Seconds to wait for each deployment (default: 1800).")
    parser.add_argument("--plan", action="store_true", help="Show the deployment steps without builds or AWS calls.")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[a-z][a-z0-9-]{2,29}", args.name):
        parser.error("--name must contain 3–30 lowercase letters, digits, or hyphens, and start with a letter.")
    if not re.fullmatch(r"[a-z]{2}(?:-[a-z]+)+-\d+", args.region):
        parser.error("--region must be an AWS region name, such as ap-south-1.")
    if args.timeout <= 0:
        parser.error("--timeout must be positive.")
    return args


def main(argv=None) -> None:
    args = parse_args(argv)
    if args.plan:
        print(f"Region: {args.region}\nResource prefix: {args.name}")
        print("Build web/dist and the Docker API image locally.")
        print("Create/reuse a private, versioned S3 bucket and upload one release snapshot.")
        print("Create/reuse ECR, three IAM roles, the default VPC, and an ECS cluster.")
        print("Create/update ECS Express: port 8000, /health, 0.25 vCPU, 1 GB, one task.")
        print("Create/reuse Amplify and upload web/dist directly, with /api and SPA rewrites.")
        print("Check the website and print its URL. Save resource IDs to .deploy/state.json.")
        print("This mode makes no AWS calls or local builds.")
        return
    for executable in ("aws", "docker", "pnpm"):
        if not shutil.which(executable):
            raise RuntimeError(f"Install {executable} before deployment.")
    aws = Aws(args.region, args.profile)
    identity = aws.call("sts", "get-caller-identity")
    account = identity["Account"]
    partition = identity["Arn"].split(":")[1]
    print(f"Deploy to AWS account {account} in {args.region}.", flush=True)
    run(["docker", "info"], capture=True)
    # Check CLI support before any resource changes.
    run(aws.base + ["ecs", "create-express-gateway-service", "--generate-cli-skeleton", "input"], capture=True)
    release = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    bucket = args.bucket or f"{args.name}-data-{account}-{args.region}"
    key = f"snapshots/{release}.zip"
    state_file = ROOT / ".deploy/state.json"
    state_file.parent.mkdir(exist_ok=True)
    state = {"account": account, "region": args.region, "name": args.name, "release": release, "bucket": bucket, "data_key": key}

    def save_state():
        state_file.write_text(json.dumps(state, indent=2) + "\n")

    with tempfile.TemporaryDirectory(prefix="solcall-deploy-") as directory:
        image, frontend, snapshot = build_release(args.name, release, Path(directory))
        print("2/6 Upload the release data snapshot to S3.", flush=True)
        ensure_bucket(aws, bucket, args.region, account)
        aws.call("s3api", "put-object", {"Bucket": bucket, "Key": key, "ContentType": "application/zip"},
                 extra=["--body", str(snapshot)])
        digest = hashlib.sha256(snapshot.read_bytes()).hexdigest()
        save_state()
        roles = ensure_roles(aws, args.name, bucket, account, partition)
        remote_image = push_image(aws, args.name, image, release)
        state["image"] = remote_image
        save_state()
        service = deploy_api(aws, args, remote_image, release, bucket, key, digest, roles)
        state["service_arn"] = service
        save_state()
        endpoint = wait_api(aws, args, service, remote_image, release)
        state["api_url"] = endpoint
        save_state()
        app_id, site = deploy_frontend(aws, args, endpoint, frontend)
        state.update(amplify_app_id=app_id, site_url=site)
        save_state()
        smoke_test(site, args.timeout)
    print(f"\nWebsite: {site}\nAPI: {endpoint}\nData: s3://{bucket}/{key}\nResources: {state_file}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        print(f"Deployment stopped: {error}", file=sys.stderr)
        sys.exit(1)
