#!/usr/bin/env python3
"""Fail on common committed-key shapes without flagging security documentation."""
from pathlib import Path
import os, re, sys

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {"node_modules", "target", ".git", "fixture", "screenshots", ".anchor", "scratch", "tools", "dist", ".cache"}
SKIP_NAMES = {"secret-scan.py", "CHECKSUMS.sha256", "wsl-payer.json"}
TEXT_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".rs", ".json", ".toml", ".yaml", ".yml", ".sh", ".sql", ".css", ".html", ".example"}
PATTERNS = {
    "PEM private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "64-byte keypair array": re.compile(r"\[(?:\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\]"),
    "long base58 secret": re.compile(r"(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{87,88}(?![1-9A-HJ-NP-Za-km-z])"),
}
findings = []

for root, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for file in files:
        if file in SKIP_NAMES:
            continue
        p = Path(root) / file
        if p.suffix not in TEXT_SUFFIXES and p.name != ".env":
            continue
        if p.name == ".env":
            findings.append((p, "non-example .env file"))
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for label, pattern in PATTERNS.items():
            if pattern.search(text):
                findings.append((p, label))

if findings:
    for path, label in findings:
        print(f"{path.relative_to(ROOT)}: {label}", file=sys.stderr)
    raise SystemExit(5)
print("secret scan passed")
