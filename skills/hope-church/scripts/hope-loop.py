# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx", "selectolax"]
# ///
"""
Fetch Hope Christian Church service info from The Loop.
"""

import argparse
import json
import sys
import httpx
from selectolax.parser import HTMLParser

LOOP_URL = "https://hopechristianchurch.updates.church/"

def fetch_loop_html() -> str:
    """Fetch the main Loop page HTML."""
    resp = httpx.get(LOOP_URL, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    return resp.text

def parse_items(html: str) -> list[dict]:
    """Parse Loop items from the main page."""
    tree = HTMLParser(html)
    items = []
    
    # The Loop uses a card-based layout - look for item containers
    # Each card has a title and optional image
    for card in tree.css('[class*="cursor-pointer"], [onclick]'):
        title_el = card.css_first('div')
        if title_el:
            title = title_el.text(strip=True)
            if title:
                items.append({"title": title, "type": "card"})
    
    return items

def fetch_sunday_service() -> dict | None:
    """
    Fetch Sunday service details.
    The Loop is a SPA, so we need to use browser automation or find API.
    For now, return cached/placeholder - full implementation needs browser.
    """
    # Note: The Loop is JavaScript-rendered. For full scraping, 
    # we'd need to use the browser tool. This script provides structure
    # for a manual or browser-based fetch.
    return {
        "note": "The Loop requires JavaScript. Use browser tool or check cached data.",
        "url": LOOP_URL
    }

def main():
    parser = argparse.ArgumentParser(description="Fetch Hope Church Loop info")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--raw", action="store_true", help="Show raw HTML")
    args = parser.parse_args()

    try:
        html = fetch_loop_html()
        
        if args.raw:
            print(html)
            return
        
        if args.json:
            print(json.dumps({
                "url": LOOP_URL,
                "note": "Loop is JS-rendered. Use browser snapshot for full details.",
                "html_length": len(html)
            }, indent=2))
        else:
            print("Hope Christian Church - The Loop")
            print("=" * 40)
            print(f"URL: {LOOP_URL}")
            print()
            print("Note: The Loop is JavaScript-rendered.")
            print("For full service details, Steve uses browser automation.")
            print()
            print("Quick access: Ask Steve about this Sunday's service!")
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
