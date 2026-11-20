import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REQUIRED_OUTPUTS = ["main.js", "manifest.json", "styles.css"]


def resolve_npm() -> str:
    """Resolve the npm executable across PATH and standard Windows Node paths."""
    for candidate in ("npm.cmd", "npm"):
        found = shutil.which(candidate)
        if found:
            return found

    if os.name == "nt":
        program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
        program_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        app_data = os.environ.get("APPDATA", "")
        windows_candidates = [
            Path(program_files) / "nodejs" / "npm.cmd",
            Path(program_files_x86) / "nodejs" / "npm.cmd",
            Path(r"C:\Program Files\nodejs\npm.cmd"),
        ]
        if local_app_data:
            windows_candidates.append(Path(local_app_data) / "Programs" / "nodejs" / "npm.cmd")
        if app_data:
            windows_candidates.append(Path(app_data) / "npm" / "npm.cmd")

        for path in windows_candidates:
            if path.is_file():
                return str(path)

    print("ERROR: npm was not found on PATH or standard Windows Node.js locations.", flush=True)
    sys.exit(1)


def run(step: str, npm_exe: str, args: list[str]) -> None:
    cmd = [npm_exe, *args]
    print(f"\n=== {step}: {' '.join(cmd)} ===", flush=True)
    result = subprocess.run(cmd, cwd=ROOT, shell=(os.name == "nt"))
    if result.returncode != 0:
        print(f"\nFAILED: {step} (exit code {result.returncode})", flush=True)
        sys.exit(result.returncode)
    print(f"OK: {step}", flush=True)


def main() -> None:
    npm_exe = resolve_npm()
    run("Install dependencies", npm_exe, ["install", "--no-audit", "--no-fund"])
    run("Unit tests", npm_exe, ["run", "test"])
    run("Type-check & bundle", npm_exe, ["run", "build"])

    missing = [f for f in REQUIRED_OUTPUTS if not (ROOT / f).is_file()]
    if missing:
        print(f"\nFAILED: missing build outputs: {', '.join(missing)}", flush=True)
        sys.exit(1)

    for f in REQUIRED_OUTPUTS:
        size = (ROOT / f).stat().st_size
        print(f"  {f:<14} {size:>10,} bytes")

    print("\nAll verification steps passed.", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
