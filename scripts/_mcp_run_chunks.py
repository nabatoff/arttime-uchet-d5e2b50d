"""Emit one-line JSON args per chunk for execute_sql (stdout = json.dumps({"query": ...}))."""
import json
import pathlib
import sys

BASE = pathlib.Path(__file__).resolve().parent


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: _mcp_run_chunks.py NNN", file=sys.stderr)
        sys.exit(2)
    n = sys.argv[1].zfill(3)
    path = BASE / f"mcp_query_{n}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    sys.stdout.write(json.dumps(data, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
