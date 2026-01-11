#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx"]
# ///
"""Etsy OAuth2 (PKCE) helper.

Starts a local callback server and walks through Etsy OAuth. Writes the
authorization URL to `/tmp/etsy_oauth_url.txt` for easy access.

Usage:
  uv run skills/etsy/scripts/etsy_oauth.py --client-id "$ETSY_API_KEY_P4P" --shop-name "Patterns4Printing" --port 8585
"""

import argparse
import base64
import hashlib
import json
import secrets
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect"
ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"

DEFAULT_SCOPES = "listings_r listings_w transactions_r shops_r profile_r email_r"


oauth_state: dict[str, str] = {}


def generate_pkce() -> tuple[str, str]:
    code_verifier = secrets.token_urlsafe(96)[:96]
    code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest()).decode().rstrip("=")
    return code_verifier, code_challenge


class OAuthHandler(BaseHTTPRequestHandler):
    def log_message(self, _format, *_args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/callback":
            self.send_response(404)
            self.end_headers()
            return

        params = parse_qs(parsed.query)
        if "error" in params:
            oauth_state["error"] = params["error"][0]
            oauth_state["error_description"] = params.get("error_description", [""])[0]
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            msg = oauth_state.get("error_description") or oauth_state["error"]
            self.wfile.write(f"<h1>❌ Etsy OAuth Error</h1><p>{msg}</p>".encode())
            return

        if "code" not in params:
            oauth_state["error"] = "missing_code"
            self.send_response(400)
            self.end_headers()
            return

        oauth_state["code"] = params["code"][0]
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        html = (
            "<html><head><title>Etsy OAuth Success</title></head>"
            "<body style=\"font-family: system-ui; padding: 40px; text-align: center;\">"
            "<h1>Authorization Successful</h1>"
            "<p>You can close this window and return to Telegram/terminal.</p>"
            "</body></html>"
        )
        self.wfile.write(html.encode())


def exchange_code_for_tokens(*, code: str, client_id: str, redirect_uri: str, code_verifier: str) -> dict:
    resp = httpx.post(
        ETSY_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code": code,
            "code_verifier": code_verifier,
        },
        timeout=30,
    )
    if not resp.is_success:
        raise RuntimeError(f"token exchange failed {resp.status_code}: {resp.text}")
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description="Etsy OAuth2 PKCE")
    parser.add_argument("--client-id", required=True, help="Etsy app client_id (aka API key)")
    parser.add_argument("--shop-name", required=True, help="Label for output file")
    parser.add_argument("--port", type=int, default=8585)
    parser.add_argument("--scope", default=DEFAULT_SCOPES)
    args = parser.parse_args()

    redirect_uri = f"http://localhost:{args.port}/callback"

    code_verifier, code_challenge = generate_pkce()
    state = secrets.token_urlsafe(16)

    auth_url = f"{ETSY_AUTH_URL}?{urlencode({
        'response_type': 'code',
        'client_id': args.client_id,
        'redirect_uri': redirect_uri,
        'scope': args.scope,
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
    })}"

    url_path = "/tmp/etsy_oauth_url.txt"
    with open(url_path, "w") as f:
        f.write(auth_url + "\n")

    print(f"\n🔐 Etsy OAuth ready for: {args.shop_name}", flush=True)
    print(f"Redirect URI: {redirect_uri}", flush=True)
    print(f"Open this URL to authorize (also saved to {url_path}):\n{auth_url}\n", flush=True)

    server = HTTPServer(("localhost", args.port), OAuthHandler)
    server.timeout = 300

    print(f"⏳ Waiting for callback on :{args.port} ...", flush=True)
    while "code" not in oauth_state and "error" not in oauth_state:
        server.handle_request()

    if "error" in oauth_state:
        err = oauth_state.get("error")
        desc = oauth_state.get("error_description")
        raise RuntimeError(f"authorization failed: {err} {desc}".strip())

    print("✅ Got code. Exchanging for tokens...", flush=True)
    tokens = exchange_code_for_tokens(
        code=oauth_state["code"],
        client_id=args.client_id,
        redirect_uri=redirect_uri,
        code_verifier=code_verifier,
    )

    out_file = f"/tmp/etsy_tokens_{args.shop_name.replace(' ', '_').lower()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_file, "w") as f:
        json.dump(tokens, f, indent=2)

    print(f"🎉 Success. Tokens saved to: {out_file}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCanceled.")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ {e}")
        sys.exit(1)
