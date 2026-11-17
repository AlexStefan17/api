#!/usr/bin/env python3
"""Write a Solr security.json with one BasicAuth user, mirroring production.

Production (zimbor.go.ro) uses BasicAuthPlugin with blockUnknown and an
admin role. The credential hash is base64(sha256(sha256(salt + password)))
stored as "<hash> <salt>", the same format Solr itself writes.

Usage:
  SOLR_TEST_USER=... SOLR_TEST_PASS=... python3 solr-security.py OUTPUT_FILE
"""
import base64
import hashlib
import json
import os
import sys


def credential(password: str) -> str:
    salt = os.urandom(32)
    digest = hashlib.sha256(hashlib.sha256(salt + password.encode("utf-8")).digest()).digest()
    return f"{base64.b64encode(digest).decode()} {base64.b64encode(salt).decode()}"


def main() -> None:
    user = os.environ.get("SOLR_TEST_USER", "")
    password = os.environ.get("SOLR_TEST_PASS", "")
    if not user or not password:
        sys.exit("SOLR_TEST_USER and SOLR_TEST_PASS must be set")
    if len(sys.argv) != 2:
        sys.exit("usage: solr-security.py OUTPUT_FILE")

    security = {
        "authentication": {
            "class": "solr.BasicAuthPlugin",
            "blockUnknown": True,
            "credentials": {user: credential(password)},
            "realm": "My Solr users",
            "forwardCredentials": False,
        },
        "authorization": {
            "class": "solr.RuleBasedAuthorizationPlugin",
            "permissions": [{"name": "security-edit", "role": "admin"}],
            "user-role": {user: ["admin"]},
        },
    }

    with open(sys.argv[1], "w") as handle:
        json.dump(security, handle, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
