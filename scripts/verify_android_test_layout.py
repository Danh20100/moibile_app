#!/usr/bin/env python3
"""Verify Android test ownership after moving Kotlin suites to root tests/android."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
VARIANTS = {
    "test": ("tests/android/unit/java", 40),
    "testDebug": ("tests/android/unitDebug/java", 9),
    "androidTest": ("tests/android/instrumentation/java", 9),
    "androidTestDebug": ("tests/android/instrumentationDebug/java", 17),
}
GRADLE = (ROOT / "app/build.gradle.kts").read_text(encoding="utf8")
errors = []
for variant, (source, expected) in VARIANTS.items():
    source_dir = ROOT / source
    count = len(list(source_dir.rglob("*.kt"))) if source_dir.is_dir() else 0
    if count < expected:
        errors.append(f"{source}: expected at least {expected} Kotlin tests, got {count}")
    old_dir = ROOT / "app/src" / variant
    if old_dir.exists() and any(old_dir.rglob("*.kt")):
        errors.append(f"Old test Kotlin files remain: {old_dir}")
    expected_mapping = (
        f'sourceSets.getByName("{variant}").kotlin.directories.add("../{source}")'
    )
    if expected_mapping not in GRADLE:
        errors.append(f"Missing AGP9 built-in Kotlin mapping: {expected_mapping}")
resources = ROOT / "tests/android/unitDebug/resources"
resource_count = sum(p.is_file() for p in resources.rglob("*")) if resources.is_dir() else 0
if resource_count < 1:
    errors.append(f"Expected one unitDebug fixture resource, got {resource_count}")
if "tests/android/unitDebug/resources" not in GRADLE:
    errors.append("Missing unitDebug resources mapping")
if 'sourceSets.getByName("testDebug").resources.srcDir("src/debug/assets")' not in GRADLE:
    errors.append("Debug fixture assets were disconnected from unit tests")
if errors:
    print("ANDROID_TEST_LAYOUT_FAIL")
    print("\n".join(errors))
    sys.exit(1)
print(
    "ANDROID_TEST_LAYOUT_PASS 75 Kotlin files (40 JVM, 9 JVM Debug, 9 instrumented, "
    "17 instrumented Debug) + 1 fixture resource; all AGP9 source sets mapped"
)
