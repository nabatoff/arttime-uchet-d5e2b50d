import pathlib

for i in range(3):
    t = pathlib.Path(f"scripts/batch_{i}.sql").read_text(encoding="utf-8")
    t = t.replace("SET LOCAL statement_timeout = '600s';\n", "")
    pathlib.Path(f"scripts/exec_{i}.sql").write_text(t, encoding="utf-8")
print("ok")
