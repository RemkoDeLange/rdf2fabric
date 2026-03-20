import json

nb_path = r'c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\05_instance_translator.ipynb'
nb = json.load(open(nb_path, encoding='utf-8'))

# Find cells with Qualified Value
for i, cell in enumerate(nb['cells']):
    source = ''.join(cell['source'])
    if 'Qualified Value' in source or 'hasUnit' in source:
        print(f"\n=== Cell {i} ===")
        print(source)
