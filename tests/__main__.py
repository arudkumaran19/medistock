"""MediStock Test Runner Package Entrypoint."""
import runpy
import sys
from pathlib import Path

tests_py = Path(__file__).resolve().parent.parent / "tests.py"
runpy.run_path(str(tests_py), run_name="__main__")
