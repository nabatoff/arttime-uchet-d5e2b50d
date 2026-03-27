import json
import pathlib

base = pathlib.Path(__file__).resolve().parent
for i in range(1, 19):
    src = base / f"mcp_query_{i:03d}.json"
    dst = base / f"_mcp_args_{i:03d}.txt"
    d = json.loads(src.read_text(encoding="utf-8"))
    dst.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    print(dst.name)
