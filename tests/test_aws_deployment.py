"""Offline checks for deployment behavior. These tests never contact AWS."""

from contextlib import redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

from scripts import deploy_aws as deploy
from scripts import start_api as startup


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.archive = self.root / "snapshot.zip"

    def bundle(self, extra=None):
        entries = {name: "{}" for name in startup.REQUIRED_FILES}
        entries["data/scraped_money_rates.csv"] = "repo_pct\n5.50\n"
        entries.update(extra or {})
        with zipfile.ZipFile(self.archive, "w") as archive:
            for name, content in entries.items():
                archive.writestr(name, content)
        return hashlib.sha256(self.archive.read_bytes()).hexdigest()

    def test_startup_downloads_exact_snapshot_before_restoring(self):
        digest = self.bundle()
        archive = self.archive
        calls = []

        class S3:
            def download_file(self, bucket, key, target):
                calls.append((bucket, key))
                Path(target).write_bytes(archive.read_bytes())

        target = self.root / "app"
        startup.load_data(target, {
            "SOLCALL_DATA_BUCKET": "private-data",
            "SOLCALL_DATA_KEY": "snapshots/release.zip",
            "SOLCALL_DATA_SHA256": digest,
        }, S3())
        self.assertEqual(calls, [("private-data", "snapshots/release.zip")])
        self.assertEqual((target / "data/scraped_money_rates.csv").read_text(), "repo_pct\n5.50\n")
        self.assertTrue((target / "out/reference_price.json").exists())

    def test_wrong_snapshot_does_not_overwrite_data(self):
        self.bundle()
        with self.assertRaisesRegex(ValueError, "checksum"):
            startup.restore_snapshot(self.archive, self.root / "app", "0" * 64)
        self.assertFalse((self.root / "app").exists())

    def test_path_escape_is_rejected_before_any_file_is_written(self):
        digest = self.bundle({"data/../../escaped": "bad"})
        with self.assertRaisesRegex(ValueError, "Invalid snapshot path"):
            startup.restore_snapshot(self.archive, self.root / "app", digest)
        self.assertFalse((self.root / "escaped").exists())
        self.assertFalse((self.root / "app/data").exists())

    def test_missing_snapshot_configuration_stops_startup(self):
        with self.assertRaisesRegex(ValueError, "together"):
            startup.load_data(self.root, {"SOLCALL_DATA_BUCKET": "private-data"})

    def test_local_startup_uses_bundled_data(self):
        startup.load_data(self.root, {})


class FakeAws:
    def __init__(self, existing=False):
        self.existing = existing
        self.calls = []

    def call(self, service, operation, payload=None):
        self.calls.append((service, operation, payload))
        if operation == "describe-vpcs":
            return {"Vpcs": [{"VpcId": "vpc-default"}]}
        if operation == "describe-subnets":
            return {"Subnets": [
                {"AvailabilityZone": "zone-a", "State": "available"},
                {"AvailabilityZone": "zone-b", "State": "available"},
            ]}
        if operation == "describe-clusters":
            return {"clusters": [{"status": "ACTIVE"}]}
        if operation == "list-services":
            return {"serviceArns": ["arn:service/solcall/solcall-api"] if self.existing else []}
        if operation == "describe-express-gateway-service":
            return {"service": {}}
        if operation in {"create-express-gateway-service", "update-express-gateway-service"}:
            return {"service": {"serviceArn": "arn:service/solcall/solcall-api"}}
        raise AssertionError((service, operation))


class DeploymentTests(unittest.TestCase):
    def test_plan_does_not_call_aws_or_build(self):
        with patch.object(deploy.Aws, "call", side_effect=AssertionError("AWS call")):
            with patch.object(deploy, "run", side_effect=AssertionError("Build")):
                with redirect_stdout(io.StringIO()):
                    deploy.main(["--plan"])

    def test_create_and_update_keep_the_same_service_and_snapshot(self):
        args = SimpleNamespace(name="solcall", region="ap-south-1")
        for existing in (False, True):
            with self.subTest(existing=existing):
                aws = FakeAws(existing)
                result = deploy.deploy_api(aws, args, "ecr/image:release", "release", "data-bucket",
                                           "snapshots/release.zip", "a" * 64, ("execution", "infra", "task"))
                self.assertEqual(result, "arn:service/solcall/solcall-api")
                operation = "update-express-gateway-service" if existing else "create-express-gateway-service"
                request = next(payload for _, op, payload in aws.calls if op == operation)
                self.assertEqual(request["primaryContainer"]["image"], "ecr/image:release")
                self.assertEqual(request["primaryContainer"]["containerPort"], 8000)
                self.assertEqual(request["taskRoleArn"], "task")
                self.assertEqual(request["scalingTarget"]["maxTaskCount"], 1)
                env = {e["name"]: e["value"] for e in request["primaryContainer"]["environment"]}
                self.assertEqual(env["SOLCALL_DATA_KEY"], "snapshots/release.zip")
                self.assertEqual(env["SOLCALL_RELEASE"], "release")
                self.assertEqual("infrastructureRoleArn" in request, not existing)

    def test_permission_error_is_not_treated_as_missing_resource(self):
        aws = deploy.Aws("ap-south-1", None)
        error = deploy.AwsError("An error occurred (AccessDenied) when calling the GetRole operation")
        with patch.object(aws, "call", side_effect=error):
            with self.assertRaises(deploy.AwsError):
                aws.optional("iam", "get-role", {"RoleName": "test"}, {"NoSuchEntity"})

    def test_old_stable_service_cannot_complete_a_new_deployment(self):
        class Aws:
            def call(self, service, operation, payload):
                if operation == "describe-express-gateway-service":
                    return {"service": {
                        "status": {"statusCode": "ACTIVE"},
                        "activeConfigurations": [{
                            "primaryContainer": {"image": "new-image"},
                            "taskDefinitionArn": "new-task",
                            "ingressPaths": [{"accessType": "PUBLIC", "endpoint": "api.example"}],
                        }],
                    }}
                return {"services": [{
                    "runningCount": 1, "desiredCount": 1,
                    "deployments": [{"status": "PRIMARY", "taskDefinition": "old-task", "rolloutState": "COMPLETED"}],
                }]}

        args = SimpleNamespace(name="solcall", timeout=1)
        with patch.object(deploy.time, "monotonic", side_effect=[0, 0, 2]):
            with patch.object(deploy.time, "sleep"):
                with patch.object(deploy, "fetch_json", side_effect=AssertionError("Old revision is not ready")):
                    with self.assertRaisesRegex(RuntimeError, "timeout"):
                        deploy.wait_api(Aws(), args, "arn:service", "new-image", "release")

    def test_ready_api_requires_the_expected_release(self):
        class Aws:
            def call(self, service, operation, payload):
                if operation == "describe-express-gateway-service":
                    return {"service": {
                        "status": {"statusCode": "ACTIVE"},
                        "activeConfigurations": [{
                            "primaryContainer": {"image": "new-image"},
                            "taskDefinitionArn": "new-task",
                            "ingressPaths": [{"accessType": "PUBLIC", "endpoint": "api.example"}],
                        }],
                    }}
                # Some ECS deployment strategies do not return rolloutState.
                return {"services": [{
                    "runningCount": 1, "desiredCount": 1, "pendingCount": 0,
                    "deployments": [{"status": "PRIMARY", "taskDefinition": "new-task"}],
                }]}

        args = SimpleNamespace(name="solcall", timeout=1)
        with patch.object(deploy, "fetch_json", side_effect=[{"release": "release"}, {"sizes": []}]):
            self.assertEqual(deploy.wait_api(Aws(), args, "arn:service", "new-image", "release"),
                             "https://api.example")

    def test_website_checks_detect_a_proxy_that_drops_query_parameters(self):
        def fetch(url):
            if "/assets/" in url:
                return b"console.log('app');"
            return b'<div id="root"></div><script src="/assets/app.js"></script>'

        def fetch_json(url):
            if "/prices" in url:
                return {"sizes": []}
            return {"inputs": {"units": 450, "load": 3, "size": 3, "quote": 240000}}

        with patch.object(deploy, "fetch", side_effect=fetch):
            with patch.object(deploy, "fetch_json", side_effect=fetch_json):
                with patch.object(deploy.time, "sleep"):
                    with patch.object(deploy.time, "monotonic", side_effect=[0, 0, 2]):
                        with self.assertRaisesRegex(RuntimeError, "query parameters"):
                            deploy.smoke_test("https://site.example", 1)

    def test_website_checks_accept_valid_routes_assets_and_distinct_queries(self):
        def fetch(url):
            if "/assets/" in url:
                return b"console.log('app');"
            return b'<div id="root"></div><script src="/assets/app.js"></script>'

        def fetch_json(url):
            if "/prices" in url:
                return {"sizes": []}
            units = 200 if "units=200" in url else 450
            return {"inputs": {"units": units, "load": 3, "size": 3, "quote": 240000, "surplus_rate": 3.5}}

        with patch.object(deploy, "fetch", side_effect=fetch):
            with patch.object(deploy, "fetch_json", side_effect=fetch_json):
                deploy.smoke_test("https://site.example", 1)


if __name__ == "__main__":
    unittest.main()
