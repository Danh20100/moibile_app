"""Assert real APK asset/DEX boundaries after assembleDebug and assembleRelease."""
from pathlib import Path
import json
import zipfile


def verify(debug_apk: Path, release_apk: Path) -> None:
    source = Path(__file__).resolve().parents[1] / "src/debug/assets/fixtures/v1"
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    members = ["manifest.json", *manifest["sources"].values()]
    with zipfile.ZipFile(debug_apk) as archive:
        for name in members:
            assert archive.read("assets/fixtures/v1/" + name) == (source / name).read_bytes(), name
    accounts = json.loads((source / "accounts.json").read_text(encoding="utf-8"))
    sentinels = ["fixtures/v1", "FixtureCatalog", "DemoData", "DemoRentalGraph", "FixtureTroOiRepository",
                 "FixtureDomains", "FixtureRental",
                 "trooi-debug-rental-v1", "TroOi2026!", "ae14d14d7f99f8c89a789a31a076a701ee994301586edb154ad8c3c21f888f7c",
                 "conversation-a02", "a02-message-1"]
    sentinels += [value for account in accounts for value in (account["userId"], account["email"], account["phone"])]
    def entity_ids(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, str) and (key == "id" or key.endswith("Id")):
                    yield child
                elif isinstance(child, list) and key.endswith("Ids"):
                    yield from (item for item in child if isinstance(item, str))
                yield from entity_ids(child)
        elif isinstance(value, list):
            for child in value:
                yield from entity_ids(child)
    for name in manifest["sources"].values():
        sentinels.extend(entity_ids(json.loads((source / name).read_text(encoding="utf-8"))))
    sentinels = sorted(set(sentinels))
    with zipfile.ZipFile(release_apk) as archive:
        assert not any("fixtures/" in name for name in archive.namelist()), "Release fixture asset"
        for name in archive.namelist():
            if name.endswith(".dex") or name.startswith("assets/"):
                data = archive.read(name)
                for sentinel in sentinels:
                    assert sentinel.encode() not in data, f"Release {name}: {sentinel}"
    print(f"PASS: {len(members)} Debug JSON assets match source; Release assets/DEX exclude {len(sentinels)} sentinels")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("debug_apk", type=Path)
    parser.add_argument("release_apk", type=Path)
    args = parser.parse_args()
    verify(args.debug_apk, args.release_apk)
