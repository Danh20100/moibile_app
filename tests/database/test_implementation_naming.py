import io
import os
import re
import tokenize
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXCLUDED_DIRECTORIES = {
    "docs", ".git", ".worktrees", "node_modules", ".venv", "build", "__pycache__"
}
FORBIDDEN_LEVEL_NAME = re.compile("l" + "v[123]", re.IGNORECASE)


def _check_path(root: Path, path: Path, violations: list[str]) -> None:
    relative = path.relative_to(root)
    if FORBIDDEN_LEVEL_NAME.search(relative.as_posix()):
        violations.append(f"path: {relative.as_posix()}")


def implementation_naming_violations(root: Path) -> list[str]:
    violations: list[str] = []
    for current_root, dirnames, filenames in os.walk(root):
        # Prune excluded directories before descending so heavy or transient
        # trees (node_modules, .git, .worktrees, ...) are never traversed.
        dirnames[:] = [name for name in dirnames if name not in EXCLUDED_DIRECTORIES]
        current_path = Path(current_root)
        for dirname in dirnames:
            _check_path(root, current_path / dirname, violations)
        for filename in filenames:
            path = current_path / filename
            _check_path(root, path, violations)
            if path.suffix == ".py":
                relative = path.relative_to(root)
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
