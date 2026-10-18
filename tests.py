#!/usr/bin/env python3
"""
MediStock Complete System Test Runner (tests.py)

Executes test suites across all MediStock tiers:
  1. Backend Unit Tests (MediStock.UnitTests)
  2. Backend API Tests (MediStock.Api.Tests)
  3. Backend Integration Tests (MediStock.IntegrationTests)
  4. Agent Service Pytest Suite (LangGraph & Specialist Agents)
  5. Web Frontend Vitest Suite (React, Components, Pages, Layouts)
  6. Flutter Mobile Analysis & Tests (Mobile Screens, SignalR, State)
  7. Live System E2E Scenario Verification (optional with --e2e or --all)

Usage:
  python tests.py                  # Run all offline automated test suites
  python tests.py --backend        # Run only .NET backend tests
  python tests.py --agent          # Run only Python agent service tests
  python tests.py --web            # Run only React web tests
  python tests.py --mobile         # Run only Flutter mobile tests
  python tests.py --e2e            # Run live end-to-end RBAC and API scenario audit
  python tests.py --all            # Run everything including live E2E scenarios
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

# Ensure UTF-8 output on Windows consoles to support checkmarks and Unicode symbols
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

# ANSI colors for pretty terminal output
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

ROOT_DIR = Path(__file__).resolve().parent

class TestResult:
    def __init__(self, name: str, passed: bool, duration: float, output: str = ""):
        self.name = name
        self.passed = passed
        self.duration = duration
        self.output = output


def run_command(name: str, cmd: list[str] | str, cwd: Path, env: dict[str, str] | None = None) -> TestResult:
    print(f"\n{BOLD}{CYAN}==> Running: {name}{RESET}")
    cmd_str = " ".join(cmd) if isinstance(cmd, list) else cmd
    print(f"{YELLOW}Command: {cmd_str}{RESET}")
    print(f"{YELLOW}Working Dir: {cwd}{RESET}\n" + "-" * 70)

    start_time = time.time()
    current_env = os.environ.copy()
    if env:
        current_env.update(env)

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(cwd),
            env=current_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=True if isinstance(cmd, str) or sys.platform == "win32" else False,
        )

        output_lines = []
        if proc.stdout:
            while True:
                line = proc.stdout.readline()
                if not line and proc.poll() is not None:
                    break
                if line:
                    try:
                        sys.stdout.write(line)
                    except UnicodeEncodeError:
                        sys.stdout.write(line.encode("ascii", "replace").decode("ascii"))
                    sys.stdout.flush()
                    output_lines.append(line)

        proc.wait()
        duration = time.time() - start_time
        passed = (proc.returncode == 0)

        if passed:
            print(f"\n{GREEN}[PASS] {name} succeeded in {duration:.2f}s{RESET}")
        else:
            print(f"\n{RED}[FAIL] {name} failed with exit code {proc.returncode} ({duration:.2f}s){RESET}")

        return TestResult(name, passed, duration, "".join(output_lines))

    except Exception as ex:
        duration = time.time() - start_time
        print(f"\n{RED}[ERROR] Could not execute {name}: {ex}{RESET}")
        return TestResult(name, False, duration, str(ex))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="MediStock Complete System Test Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--backend", action="store_true", help="Run only .NET backend tests")
    parser.add_argument("--agent", action="store_true", help="Run only Python agent service tests")
    parser.add_argument("--web", action="store_true", help="Run only React web frontend tests")
    parser.add_argument("--mobile", action="store_true", help="Run only Flutter mobile tests")
    parser.add_argument("--e2e", action="store_true", help="Run live E2E integration scenario audit")
    parser.add_argument("--all", action="store_true", help="Run all automated suites plus live E2E")

    args = parser.parse_args()

    # Determine which suites to run
    run_all_default = not any([args.backend, args.agent, args.web, args.mobile, args.e2e, args.all])

    run_backend = args.backend or args.all or run_all_default
    run_agent = args.agent or args.all or run_all_default
    run_web = args.web or args.all or run_all_default
    run_mobile = args.mobile or args.all or run_all_default
    run_e2e = args.e2e or args.all

    print(f"\n{BOLD}{CYAN}========================================================================")
    print("                    MEDISTOCK SYSTEM TEST RUNNER")
    print(f"========================================================================{RESET}")

    results: list[TestResult] = []

    # 1. Backend Tests
    if run_backend:
        backend_suites = [
            ("Backend Unit Tests", "dotnet test backend/tests/MediStock.UnitTests/MediStock.UnitTests.csproj", ROOT_DIR),
            ("Backend API Tests", "dotnet test backend/tests/MediStock.Api.Tests/MediStock.Api.Tests.csproj", ROOT_DIR),
            ("Backend Integration Tests", "dotnet test backend/tests/MediStock.IntegrationTests/MediStock.IntegrationTests.csproj", ROOT_DIR),
        ]
        for name, cmd, cwd in backend_suites:
            results.append(run_command(name, cmd, cwd))

    # 2. Agent Service Tests
    if run_agent:
        agent_dir = ROOT_DIR / "agent-service"
        # Determine python executable inside agent venv if present
        venv_pytest = agent_dir / ".venv" / "Scripts" / "pytest.exe"
        if not venv_pytest.exists():
            venv_pytest = agent_dir / ".venv" / "bin" / "pytest"

        agent_cmd = f'"{venv_pytest}"' if venv_pytest.exists() else "pytest"
        results.append(run_command("Agent Service Pytest Suite", f"{agent_cmd} tests", agent_dir, env={"PYTHONPATH": "src", "LLM_PROVIDER": "mock"}))

    # 3. Web Frontend Tests
    if run_web:
        web_dir = ROOT_DIR / "web"
        results.append(run_command("Web Frontend Tests (Vitest)", "npm test", web_dir))

    # 4. Flutter Mobile Tests
    if run_mobile:
        mobile_dir = ROOT_DIR / "mobile"
        results.append(run_command("Flutter Static Analysis", "flutter analyze", mobile_dir))
        results.append(run_command("Flutter Mobile Test Suite", "flutter test", mobile_dir))

    # 5. Live E2E Scenario Verification
    if run_e2e:
        e2e_script = ROOT_DIR / "scratch" / "verify_all_scenarios.py"
        if e2e_script.exists():
            results.append(run_command("Live System E2E Scenario Audit", f"python {e2e_script}", ROOT_DIR))
        else:
            print(f"{YELLOW}[WARN] E2E scenario script not found at {e2e_script}{RESET}")

    # Print Summary Table
    print(f"\n{BOLD}{CYAN}========================================================================")
    print("                       TEST EXECUTION SUMMARY")
    print(f"========================================================================{RESET}")

    total_time = sum(r.duration for r in results)
    passed_count = sum(1 for r in results if r.passed)
    failed_count = sum(1 for r in results if not r.passed)

    for r in results:
        status_str = f"{GREEN}PASS{RESET}" if r.passed else f"{RED}FAIL{RESET}"
        print(f"  {status_str:10} | {r.name:<40} | {r.duration:>6.2f}s")

    print("-" * 72)
    print(f"Total Suites: {len(results)} | {GREEN}Passed: {passed_count}{RESET} | {RED}Failed: {failed_count}{RESET} | Duration: {total_time:.2f}s")
    print(f"{BOLD}{CYAN}========================================================================{RESET}\n")

    return 0 if failed_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
