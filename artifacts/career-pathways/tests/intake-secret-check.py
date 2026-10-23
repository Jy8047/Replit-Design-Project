"""Read-only, value-redacted local Git check, NOT GitHub secret-scanning verification.

Never reads environment secrets, network services or Git remote URL credentials.
Output contains paths, line numbers, rule names and counts only, never matches.
"""
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
MAX_BYTES = 2 * 1024 * 1024

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)

RULES = {
    "service-token-shape": re.compile(rb"\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|rpa_[A-Za-z0-9_-]{24,}|rps_[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b"),
    "private-key-header": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "literal-secret-assignment": re.compile(rb"""\b(?:RUNPOD_API_KEY|CLERK_SECRET_KEY|SESSION_SECRET|api_key|apiKey)\b["']?\s*[:=]\s*["']([^"'\r\n]{12,})["']""", re.I),
}
PLACEHOLDERS = {b"fictional-test-credential", b"fictional-test-key", b"your-api-key-here"}
findings = []
skipped = {"binary": 0, "oversize": 0, "symlink": 0}
placeholder_count = 0

def scan(content, path, scope):
    global placeholder_count
    if len(content) > MAX_BYTES:
        skipped["oversize"] += 1
        return
    if b"\0" in content:
        skipped["binary"] += 1
        return
    for rule, pattern in RULES.items():
        for match in pattern.finditer(content):
            if rule == "literal-secret-assignment" and match.group(1) in PLACEHOLDERS:
                placeholder_count += 1
                continue
            findings.append({
                "scope": scope, "path": path, "rule": rule,
                "line": content.count(b"\n", 0, match.start()) + 1,
            })

paths = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split(b"\0")
worktree_count = 0
tracked_sensitive_paths = []
for raw in paths:
    if not raw:
        continue
    path = raw.decode("utf-8", "replace")
    p = ROOT / path
    if p.is_symlink():
        skipped["symlink"] += 1
        continue
    if not p.is_file():
        continue
    worktree_count += 1
    if p.stat().st_size > MAX_BYTES:
        skipped["oversize"] += 1
        continue
    scan(p.read_bytes(), path, "current")
    name = p.name
    if name.startswith(".env") and name not in {".env.example", ".env.sample"}:
        tracked_sensitive_paths.append(path)

objects = git("rev-list", "--objects", "--all").decode().splitlines()
batch = subprocess.Popen(["git", "cat-file", "--batch"], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
blob_count = 0
try:
    for entry in objects:
        oid, _, path = entry.partition(" ")
        batch.stdin.write((oid + "\n").encode())
        batch.stdin.flush()
        header = batch.stdout.readline().decode().strip().split()
        if len(header) != 3:
            raise RuntimeError("Git object unavailable; historical scan incomplete")
        kind, size = header[1], int(header[2])
        if kind == "blob" and size <= MAX_BYTES:
            scan(batch.stdout.read(size), path or "(unnamed blob)", "reachable-history")
            blob_count += 1
        else:
            remaining = size
            while remaining:
                chunk = batch.stdout.read(min(remaining, 65536))
                if not chunk:
                    raise RuntimeError("Incomplete Git object")
                remaining -= len(chunk)
            if kind == "blob":
                skipped["oversize"] += 1
        batch.stdout.read(1)
finally:
    batch.stdin.close()
    batch.wait()

ignored = {}
for name in [".env", ".env.local", ".env.production", ".env.example", ".env.sample"]:
    ignored[name] = subprocess.run(["git", "check-ignore", "-q", "--", name], cwd=ROOT).returncode == 0
print(json.dumps({
    "current_files": worktree_count,
    "local_commits": int(git("rev-list", "--all", "--count")),
    "reachable_blobs_scanned": blob_count,
    "skipped": skipped,
    "known_fictional_placeholder_occurrences": placeholder_count,
    "suspected_secret_count": len(findings),
    "findings_without_values": findings,
    "sensitive_paths_in_candidate_files": tracked_sensitive_paths,
    "ignore_checks": ignored,
    "github_remote_alerts_permissions_and_remote_only_history": "NOT_VERIFIED",
    "scope": "local current candidate files and locally reachable Git history; regex heuristic only",
}, ensure_ascii=False, indent=2))
