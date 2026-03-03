"""Quick script to list cells in a notebook."""
import json, sys

path = sys.argv[1] if len(sys.argv) > 1 else "src/notebooks/08_ontology_api_client.ipynb"
nb = json.load(open(path, encoding="utf-8"))
for i, c in enumerate(nb["cells"]):
    src = "".join(c["source"])[:120].replace("\n", " | ")
    print(f"Cell {i:2d}: {c['cell_type']:8s} | {src}")
