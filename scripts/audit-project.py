#!/usr/bin/env python3
"""Static delivery audit; this does not replace Anchor compilation or an external audit."""
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
failures: list[str] = []
def require(condition: bool, message: str) -> None:
    if not condition: failures.append(message)

required = [
    "Anchor.toml", "Cargo.toml", "package.json", "README.md", "AGENT_HANDOFF.md", "LICENSE-PENDING.md",
    "apps/web/src/App.tsx", "apps/web/src/components/surfaces.tsx", "apps/web/fixture/index.html",
    "apps/cli/src/index.ts", "apps/indexer/src/server.ts", "packages/sdk/src/index.ts",
    "packages/tally/src/manifest.ts", "packages/confidential/src/index.ts",
    "docs/BUILD_REPORT.md", "docs/IMPLEMENTATION_STATUS.md",
]
for item in required: require((ROOT/item).is_file(), f"missing {item}")

for path in ROOT.rglob("*.json"):
    if any(part in {"node_modules", "target"} for part in path.parts): continue
    try: json.loads(path.read_text())
    except Exception as error: failures.append(f"invalid JSON {path.relative_to(ROOT)}: {error}")

programs = ["norr-launch", "norr-claim", "norr-fees", "norr-market", "norr-boards", "norr-social", "norr-wrap"]
for program in programs:
    require((ROOT/f"programs/{program}/Cargo.toml").is_file(), f"missing {program} manifest")
    source = ROOT/f"programs/{program}/src/lib.rs"
    require(source.is_file() and source.stat().st_size > 1_000, f"missing/short {program} source")

app = (ROOT/"apps/web/src/App.tsx").read_text()
route_block = re.search(r"ROUTE_ENTRIES=\[(.*?)\] as const", app, re.S)
routes = re.findall(r'"([^"\n]+)"', route_block.group(1) if route_block else "")
require(len(routes) == 19, f"expected 19 route entries, found {len(routes)}")
require(len(routes) == len(set(routes)), "duplicate route entry")

component_text = "\n".join(path.read_text() for path in (ROOT/"apps/web/src/components").rglob("*.tsx"))
exports = set(re.findall(r"export (?:function|class) ([A-Za-z0-9_]+)", component_text))
expected = {"ActionButton","Activity","BoardDetail","Boards","Card","ChainGuard","CommandPalette","Compare","Contribute","CreateLaunch","Discussion","Earnings","ErrorBoundary","FeeBuilder","Feed","Holders","IdoClaim","LaunchDetail","LaunchModels","Leaderboard","Logo","Market","NodeStatus","Portfolio","Preferences","Prerequisites","PriceAlert","PrivacyLedger","PrivateVault","Profile","Promote","ProofVerifier","ShareCard","Shell","Shortcuts","Skeleton","StatusDisplay","StyledIntput","Timeline","Toasts","Tour"}
require(expected <= exports, "missing component exports: " + ", ".join(sorted(expected-exports)))

fixture_html = list((ROOT/"apps/web/fixture").glob("*.html"))
require(len(fixture_html) >= 8, f"expected at least 8 fixture routes, found {len(fixture_html)}")
require(not list((ROOT/"apps/web/fixture").glob("*.map")), "fixture source maps should not ship")
fixture_js = ROOT/"apps/web/fixture/fixture.js"
require(fixture_js.is_file() and fixture_js.stat().st_size > 100_000, "offline fixture bundle missing")

css = "\n".join(path.read_text().lower() for path in (ROOT/"apps/web/src/styles").glob("*.css"))
for forbidden in ("backdrop-filter", "blur(", "scale(", "glassmorphism"):
    require(forbidden not in css, f"forbidden design pattern: {forbidden}")
for value in re.findall(r"(?:font-size|--t-[a-z-]+)\s*:\s*([0-9.]+)px", css):
    require(float(value) >= 12, f"text token below 12px: {value}px")
for value in re.findall(r"border-radius\s*:\s*([0-9.]+)px", css):
    require(float(value) <= 2, f"radius above 2px: {value}px")
require("linear-gradient(var(--sol" not in css and "linear-gradient(90deg,var(--sol" not in css, "violet gradient detected")

surface = (ROOT/"apps/web/src/components/surfaces.tsx").read_text()
require("P0 required" in surface and "Private value movement is disabled" in surface, "private fail-closed copy missing")
require("decryptedAmount" not in surface and "totalContributed" not in surface, "private aggregate leaked into UI source")
require('placeholder="Unavailable" disabled' in surface, "sealed contribution input is not visibly disabled")

for path in ROOT.rglob("*"):
    if path.is_file() and any(part in {"node_modules", "target", ".git"} for part in path.parts):
        failures.append(f"generated dependency directory included: {path.relative_to(ROOT)}")
        break

if failures:
    print("PROJECT AUDIT FAILED", file=sys.stderr)
    for item in failures: print(f"- {item}", file=sys.stderr)
    raise SystemExit(1)
print(f"project audit passed: {len(programs)} programs, {len(routes)} routes, {len(expected)} required component surfaces, {len(fixture_html)} fixture pages")
