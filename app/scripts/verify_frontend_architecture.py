"""Bounded source guards; APK isolation and typed fixture tests remain separate gates."""
from collections import Counter
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]
LEGACY = re.compile(r"\b(?:V1Panel|V1Action|V1SecondaryAction|V1PageTitle|V1Metric|V1Pending|TroOiPrimaryButton)\b")
MATERIAL = re.compile(r"\b(?:Button|OutlinedButton|TextButton|OutlinedTextField|TextField|Scaffold|AlertDialog|Card|ElevatedCard|OutlinedCard)\s*\(")
DEBUG = re.compile(r"\b(?:DemoData|DemoRentalGraph|DebugFixtureCatalog|FixtureCatalog|FixtureTroOiRepository)\b|fixtures/v1")
EXCEPTIONS = {
    ("features/auth/AuthScreens.kt", "Button"): 1,  # Google brand action.
    ("features/discovery/StreetMapPicker.kt", "TextButton"): 1,  # Required provider attribution.
    ("features/ledger/AssetWizard.kt", "OutlinedCard"): 1,  # Selected asset-type choice.
}
PRIMITIVES = {"TroOiPrimitives.kt", "TroOiPage.kt", "TroOiFormField.kt"}


def entity_ids(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if isinstance(child, str) and (key == "id" or key.endswith("Id")):
                yield child
            yield from entity_ids(child)
    elif isinstance(value, list):
        for child in value:
            yield from entity_ids(child)


def violations(path: str, source: str, seed_literals: set[str]) -> list[str]:
    errors = []
    if LEGACY.search(source):
        errors.append("retired generic UI")
    if path.startswith(("main/", "release/")):
        if DEBUG.search(source):
            errors.append("Debug catalog dependency")
        if any('"' + value + '"' in source for value in seed_literals):
            errors.append("immutable fixture literal outside Debug")
    if path.startswith("main/java/com/trooi/app/"):
        relative = path.removeprefix("main/java/com/trooi/app/")
        if not (relative.startswith("ui/components/") and Path(relative).name in PRIMITIVES):
            counts = Counter(match.group().split("(")[0].strip() for match in MATERIAL.finditer(source))
            for widget, count in counts.items():
                if count > EXCEPTIONS.get((relative, widget), 0):
                    errors.append("generic Material " + widget)
        if relative.startswith("ui/components/") and Path(relative).name != "RoomLedgerComponents.kt" and re.search(r"Color\s*\(\s*0x|RoundedCornerShape\s*\(", source):
            errors.append("generic component bypasses theme tokens")
    return errors


def verify() -> None:
    fixtures = ROOT / "app/src/debug/assets/fixtures/v1"
    accounts = json.loads((fixtures / "accounts.json").read_text(encoding="utf-8"))
    seeds = {a[key] for a in accounts for key in ("userId", "email", "phone")}
    seeds.add("trooi-debug-rental-v1")
    for file in fixtures.glob("*.json"):
        seeds.update(entity_ids(json.loads(file.read_text(encoding="utf-8"))))
    errors = []
    for file in (ROOT / "app/src").rglob("*.kt"):
        path = file.relative_to(ROOT / "app/src").as_posix()
        errors.extend(f"{path}: {error}" for error in violations(path, file.read_text(encoding="utf-8"), seeds))
    for file in (ROOT / "app/src").rglob("fixtures/v1/manifest.json"):
        if "debug" not in file.relative_to(ROOT / "app/src").parts:
            errors.append(str(file) + ": catalog outside Debug source set")
    assert not errors, "\n".join(errors)
    print("PASS: retired UI, bounded Material exceptions, generic theme tokens and Debug catalog ownership")


def self_check() -> None:
    feature = "main/java/com/trooi/app/features/example/NewScreen.kt"
    assert violations(feature, 'V1Panel("x")', set())
    assert violations(feature, 'Button({}) {}', set())
    assert violations(feature, 'DemoData.read', set())
    assert violations(feature, 'val id = "fixture-user-example"', {"fixture-user-example"})
    assert not violations(feature, 'TroOiButton("Save", {})', set())
    brand = "main/java/com/trooi/app/features/auth/AuthScreens.kt"
    assert not violations(brand, 'Button({}) {}', set())
    assert violations(brand, 'Button({}) {}; Button({}) {}', set())
    assert violations("main/java/com/trooi/app/ui/components/NewCard.kt", "Color(0xFF000000)", set())
    assert not violations("debug/java/Demo.kt", 'val id = "fixture-user-example"', {"fixture-user-example"})
    assert set(entity_ids({"roomId": "r", "nested": [{"id": "message"}]})) == {"r", "message"}


if __name__ == "__main__":
    self_check()
    verify()
