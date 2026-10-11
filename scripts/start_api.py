"""Load the release's S3 data snapshot before the API imports its data."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tempfile
import zipfile

REQUIRED_FILES = {
    "data/delhi_rules.json",
    "data/price_observations.json",
    "out/reference_price.json",
    "out/provenance.json",
}


def restore_snapshot(archive: Path, root: Path, sha256: str) -> None:
    if hashlib.sha256(archive.read_bytes()).hexdigest() != sha256:
        raise ValueError("The S3 snapshot checksum does not match this release.")
    root = root.resolve()
    with zipfile.ZipFile(archive) as bundle:
        if not REQUIRED_FILES.issubset(bundle.namelist()):
            raise ValueError("The S3 snapshot is missing required data files.")
        # Validate every path before extracting any file.
        for entry in bundle.infolist():
            path = PurePosixPath(entry.filename)
            if (
                path.is_absolute()
                or not path.parts
                or path.parts[0] not in {"data", "out"}
                or ".." in path.parts
                or stat.S_ISLNK(entry.external_attr >> 16)
                or not (root / entry.filename).resolve().is_relative_to(root)
            ):
                raise ValueError(f"Invalid snapshot path: {entry.filename}")
        for entry in bundle.infolist():
            destination = root / entry.filename
            if entry.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(entry) as source, destination.open("wb") as target:
                    shutil.copyfileobj(source, target)


def load_data(root: Path, environ: dict[str, str], client=None) -> None:
    bucket = environ.get("SOLCALL_DATA_BUCKET")
    key = environ.get("SOLCALL_DATA_KEY")
    sha256 = environ.get("SOLCALL_DATA_SHA256")
    if not any((bucket, key, sha256)):
        return  # Local Docker runs use the data already in the image.
    if not all((bucket, key, sha256)):
        raise ValueError("Set SOLCALL_DATA_BUCKET, SOLCALL_DATA_KEY, and SOLCALL_DATA_SHA256 together.")
    if client is None:
        import boto3

        client = boto3.client("s3")  # ECS supplies credentials through the task role.
    with tempfile.TemporaryDirectory(prefix="solcall-data-") as directory:
        archive = Path(directory) / "snapshot.zip"
        client.download_file(bucket, key, str(archive))
        restore_snapshot(archive, root, sha256)
    print("Loaded the release data snapshot from S3.", flush=True)


def main() -> None:
    load_data(Path(__file__).resolve().parents[1], dict(os.environ))
    os.execv(sys.executable, [
        sys.executable, "-m", "uvicorn", "solcall.api:app",
        "--host", "0.0.0.0", "--port", "8000",
    ])


if __name__ == "__main__":
    main()
