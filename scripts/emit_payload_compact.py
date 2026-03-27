"""Emit compact UTF-8 JSON lines for payload_000..payload_N (for MCP execute_sql)."""
import json
import pathlib
import sys

def main() -> None:
    root = pathlib.Path(__file__).resolve().parent
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 18
    for i in range(start, end + 1):
        path = root / f"payload_{i:03d}.json"
        d = json.loads(path.read_text(encoding="utf-8"))
        sys.stdout.buffer.write(json.dumps(d, ensure_ascii=False).encode("utf-8"))
        sys.stdout.buffer.write(b"\n")


if __name__ == "__main__":
    main()
