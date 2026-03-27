import json
import pathlib
import sys

start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
end = int(sys.argv[2]) if len(sys.argv) > 2 else 19
base = pathlib.Path(__file__).resolve().parent
for i in range(start, end):
    p = base / f"payload_{i:03d}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    print(f"---P{i}---")
    print(json.dumps(d, ensure_ascii=False))
