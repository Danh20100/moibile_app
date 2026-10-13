#!/usr/bin/env python3
"""Check local Markdown links without treating archive-only raw QA artifacts as tracked proof."""
from pathlib import Path
import argparse
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>]+>|[^)\s]+)")
SKIP = ("http:", "https:", "mailto:", "tel:", "data:", "app:", "javascript:")


def check_links(doc: Path) -> tuple[int, list[str]]:
    text = doc.read_text(encoding="utf8", errors="replace")
    checked = 0
    missing = []
    for match in LINK.finditer(text):
        value = match.group(1).strip("<>").strip()
        if not value or value.startswith(("#", *SKIP)):
            continue
        path = unquote(urlsplit(value).path)
        if not path:
            continue
        candidate = (doc.parent / path).resolve(strict=False)
        if not candidate.is_relative_to(ROOT):
            continue  # Absolute/user/runtime targets are outside repository scope.
        checked += 1
        if not candidate.exists():
            missing.append(f"{doc.relative_to(ROOT).as_posix()}: {value}")
    return checked, missing


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("docs", "all"), default="all")
    args = parser.parse_args()
    paths = sorted((ROOT / "docs").rglob("*.md"))
    if args.scope == "all":
        paths.extend([p for p in (ROOT / "README.md", ROOT / "tests/android/README.md") if p.is_file()])
    count = 0
    missing = []
    for path in paths:
        seen, broken = check_links(path)
        count += seen
        missing.extend(broken)
    for entry in missing[:70]:
        print(f"MISSING_LOCAL_MARKDOWN_LINK {entry}")
    if missing:
        print(f"DOC_LINKS_FAIL docs={len(paths)} checked={count} missing={len(missing)}")
        sys.exit(1)
    print(f"DOC_LINKS_PASS docs={len(paths)} local_links={count} missing=0")


if __name__ == "__main__":
    main()
