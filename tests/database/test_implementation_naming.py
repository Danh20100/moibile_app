import io
import re
import tokenize
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXCLUDED_DIRECTORIES = {
    "docs", ".git", "node_modules", ".venv", "build", "__pycache__"
}
FORBIDDEN_LEVEL_NAME = re.compile("l" + "v[123]", re.IGNORECASE)


def implementation_naming_violations(root: Path) -> list[str]:
    violations: list[str] = []
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_DIRECTORIES for part in relative.parts):
            continue
        if FORBIDDEN_LEVEL_NAME.search(relative.as_posix()):
            violations.append(f"path: {relative.as_posix()}")
        if path.is_file() and path.suffix == ".py":
            source = path.read_bytes()
            for token in tokenize.tokenize(io.BytesIO(source).readline):
                if token.type == tokenize.NAME and FORBIDDEN_LEVEL_NAME.search(token.string):
                    violations.append(
                        f"identifier: {relative.as_posix()}:{token.start[0]}:{token.start[1] + 1} "
                        f"{token.string}"
                    )
    return sorted(violations)


class ImplementationNamingTests(unittest.TestCase):
    def test_implementation_paths_and_python_names_are_semantic(self):
        violations = implementation_naming_violations(ROOT)
        self.assertEqual([], violations, "\n".join(violations))


if __name__ == "__main__":
    unittest.main()
