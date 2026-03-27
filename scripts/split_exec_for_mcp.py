"""Разбить SQL на части < 35000 символов по границам ';\\n'."""
from __future__ import annotations

import pathlib

SRC = pathlib.Path(__file__).resolve().parent / "exec_0.sql"
text = SRC.read_text(encoding="utf-8")
parts: list[str] = []
cur: list[str] = []
cur_len = 0
max_chunk = 35000

for stmt in text.split(";\n"):
    if not stmt.strip():
        continue
    block = stmt.rstrip() + ";\n"
    if cur_len + len(block) > max_chunk and cur:
        parts.append("".join(cur))
        cur = []
        cur_len = 0
    cur.append(block)
    cur_len += len(block)
if cur:
    parts.append("".join(cur))

out_dir = pathlib.Path(__file__).resolve().parent
for i, p in enumerate(parts):
    (out_dir / f"exec_0_part{i}.sql").write_text(p, encoding="utf-8")
print(f"parts: {len(parts)}, lens: {[len(x) for x in parts]}")
