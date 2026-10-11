"""
Domain exceptions.

All scraper-specific errors live here so that upper layers can catch
domain-level failures without importing infrastructure details.
"""


class ScraperError(Exception):
    """Base for all scraper errors."""


class FetchError(ScraperError):
    """Could not fetch a remote resource."""


class ParseError(ScraperError):
    """Fetched data could not be parsed into the expected structure."""


class ValidationError(ScraperError):
    """Parsed data failed a domain-level consistency check."""
