"""
Thin HTTP client wrapper around urllib.

Provides a single `get` function with timeout, retries, and a
consistent error surface (raises FetchError on failure).
Standard library only — no requests/httpx.
"""

from __future__ import annotations

import logging
import time
import urllib.request
import urllib.error
from typing import Optional

from src.domain.exceptions import FetchError

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30      # seconds
_DEFAULT_RETRIES = 2
_DEFAULT_BACKOFF = 1.5     # seconds between retries


def get(
    url: str,
    *,
    timeout: int = _DEFAULT_TIMEOUT,
    retries: int = _DEFAULT_RETRIES,
    backoff: float = _DEFAULT_BACKOFF,
    headers: Optional[dict[str, str]] = None,
) -> bytes:
    """
    GET *url* and return the response body as bytes.

    Retries on transient HTTP errors (5xx) and network errors.
    Raises ``FetchError`` if all attempts fail.
    """
    req_headers = {
        "User-Agent": "SolCall/1.0 (Delhi Solar Feed; +https://github.com/mynk8/solcall)",
    }
    if headers:
        req_headers.update(headers)

    request = urllib.request.Request(url, headers=req_headers)
    last_err: Optional[Exception] = None

    for attempt in range(1, retries + 2):   # retries + 1 total attempts
        try:
            logger.debug("GET %s  (attempt %d)", url, attempt)
            with urllib.request.urlopen(request, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            last_err = exc
            if exc.code < 500:
                raise FetchError(
                    f"HTTP {exc.code} from {url}: {exc.reason}"
                ) from exc
            logger.warning("HTTP %d from %s — retrying (%d/%d)",
                           exc.code, url, attempt, retries + 1)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_err = exc
            logger.warning("Network error fetching %s — retrying (%d/%d): %s",
                           url, attempt, retries + 1, exc)

        if attempt <= retries:
            time.sleep(backoff * attempt)

    raise FetchError(f"All {retries + 1} attempts failed for {url}") from last_err
