"""
Generate a fresh, non-authenticated (public) YouTube cookie jar using Playwright.

This produces a Netscape cookie file compatible with yt-dlp. No login is performed:
it just loads the homepage, accepts/declines consent, then exports cookies.

Usage:
  python generate_public_cookies.py --output /tmp/ytdlp_public_cookies.txt

Prerequisites:
  pip install playwright
  python -m playwright install chromium
"""

import argparse
import os
from datetime import datetime
from pathlib import Path
from typing import Iterable

from playwright.sync_api import sync_playwright


def to_netscape(cookies: Iterable[dict]) -> str:
    """Convert Playwright cookies to Netscape format (yt-dlp compatible)."""
    lines = [
        "# Netscape HTTP Cookie File",
        f"# Generated {datetime.utcnow().isoformat()}Z",
        "# This file can be used with yt-dlp via the --cookies option.",
    ]
    for c in cookies:
        # Required fields: domain, flag, path, secure, expiry, name, value
        domain = c.get("domain", "")
        flag = "TRUE" if domain.startswith(".") else "FALSE"
        path = c.get("path", "/")
        secure = "TRUE" if c.get("secure") else "FALSE"
        expires = int(c.get("expires", 0)) if c.get("expires") else 0
        name = c.get("name", "")
        value = c.get("value", "")
        lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{expires}\t{name}\t{value}")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Generate public YouTube cookies for yt-dlp.")
    parser.add_argument(
        "--output",
        default="ytdlp_public_cookies.txt",
        help="Path to write the Netscape cookie file (default: ./ytdlp_public_cookies.txt)",
    )
    parser.add_argument(
        "--user-agent",
        default=(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        help="User-Agent to use for the browser context.",
    )
    args = parser.parse_args()

    output_path = Path(args.output).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=args.user_agent,
            locale="en-US",
            geolocation={"latitude": 37.4219999, "longitude": -122.0840575},
            permissions=["geolocation"],
        )
        page = context.new_page()

        page.goto("https://www.youtube.com", wait_until="networkidle")

        # Try to close/accept consent if present
        try:
            for selector in [
                "button:has-text('Reject all')",
                "button:has-text('I agree')",
                "button:has-text('Agree')",
                "button:has-text('Accept all')",
            ]:
                if page.is_visible(selector):
                    page.click(selector, timeout=1000)
                    break
        except Exception:
            pass

        # Small wait to ensure cookies are set
        page.wait_for_timeout(1000)

        cookies = context.cookies()
        netscape = to_netscape(cookies)
        output_path.write_text(netscape, encoding="utf-8")

        browser.close()

    print(f"[ok] Cookies written to {output_path}")


if __name__ == "__main__":
    main()
