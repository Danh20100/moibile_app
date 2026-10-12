#!/usr/bin/env python3
"""Reject green but empty Android JVM test tasks (AGP 9 Kotlin source-set guard)."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
results = ROOT / "app/build/test-results/testDebugUnitTest"
paths = sorted(results.glob("TEST-*.xml"))
if not paths:
    print(f"ANDROID_JVM_TEST_DISCOVERY_FAIL no JUnit XML in {results}")
    sys.exit(1)
suites = [ET.parse(p).getroot() for p in paths]
count = sum(int(s.get("tests", 0)) for s in suites)
failures = sum(int(s.get("failures", 0)) + int(s.get("errors", 0)) for s in suites)
skipped = sum(int(s.get("skipped", 0)) for s in suites)
if len(suites) < 49 or count < 192 or failures:
    print(
        f"ANDROID_JVM_TEST_DISCOVERY_FAIL suites={len(suites)} "
        f"tests={count} failures_or_errors={failures} skipped={skipped}"
    )
    sys.exit(1)
print(
    f"ANDROID_JVM_TEST_DISCOVERY_PASS suites={len(suites)} "
    f"tests={count} failures_or_errors=0 skipped={skipped}"
)
