"""Write {query: ...} JSON files for user-supabase execute_sql from payload_*.json."""
import json
import pathlib

base = pathlib.Path(__file__).resolve().parent
for p in sorted(base.glob("payload_*.json")):
    d = json.loads(p.read_text(encoding="utf-8"))
    out = base / f"mcp_query_{p.stem.replace('payload_', '')}.json"
    out.write_text(json.dumps({"query": d["query"]}, ensure_ascii=False), encoding="utf-8")
    print(out.name, len(d["query"]))
