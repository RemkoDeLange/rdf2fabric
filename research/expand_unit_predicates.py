"""
Expand NB05 unit predicate support from single NEN2660 to multiple standards.

Changes:
1. Replace single NEN2660_HASUNIT with KNOWN_UNIT_PREDICATES list
2. Update Step 3 to filter for any predicate in the list
"""
import json

NB_PATH = "src/notebooks/05_instance_translator.ipynb"

# Old cell content (cell 11 - qualified value extraction)
OLD_HEADER = '''# NEN 2660-2 Qualified Value Extraction
# Handle reified values with rdf:value pattern:
# ?subject ?property [ rdf:value ?value ; nen2660:hasUnit ?unit ]

RDF_VALUE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#value"
NEN2660_HASUNIT = "https://w3id.org/nen2660/def#hasUnit"'''

NEW_HEADER = '''# Qualified Value Extraction (rdf:value pattern)
# Handle reified values: ?subject ?property [ rdf:value ?value ; ?unitPred ?unit ]
# Supports multiple unit predicates from different standards (auto-detected)

RDF_VALUE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#value"

# Known unit predicates from common ontologies
# Each is checked - only those present in data are used
KNOWN_UNIT_PREDICATES = [
    "https://w3id.org/nen2660/def#hasUnit",       # NEN 2660-2 (built environment)
    "http://qudt.org/schema/qudt/unit",            # QUDT 2.x (scientific/engineering)
    "http://qudt.org/schema/qudt/hasUnit",         # QUDT variant
    "http://schema.org/unitCode",                  # Schema.org (web/e-commerce)
]'''

OLD_STEP3 = '''# Step 3: Find nen2660:hasUnit triples on blank nodes
df_units = df_triples.filter(
    F.col("predicate") == NEN2660_HASUNIT
).select(
    F.col("subject").alias("blank_node"),
    F.col("object").alias("unit_uri"),
    F.col("graph")
)'''

NEW_STEP3 = '''# Step 3: Find unit triples on blank nodes (any known unit predicate)
df_units = df_triples.filter(
    F.col("predicate").isin(KNOWN_UNIT_PREDICATES)
).select(
    F.col("subject").alias("blank_node"),
    F.col("object").alias("unit_uri"),
    F.col("graph")
)

# Log which unit predicates were found
found_unit_preds = df_triples.filter(
    F.col("predicate").isin(KNOWN_UNIT_PREDICATES)
).select("predicate").distinct().collect()
if found_unit_preds:
    print(f"Unit predicates found in data: {[r.predicate for r in found_unit_preds]}")'''


def update_notebook():
    with open(NB_PATH, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    # Find cell 11 (qualified value extraction)
    cell = nb['cells'][11]
    source = ''.join(cell.get('source', []))
    
    # Verify we have the right cell
    if 'NEN2660_HASUNIT' not in source:
        print("ERROR: Cell 11 doesn't contain NEN2660_HASUNIT")
        return False
    
    # Apply replacements
    new_source = source.replace(OLD_HEADER, NEW_HEADER)
    new_source = new_source.replace(OLD_STEP3, NEW_STEP3)
    
    # Convert back to list format for notebook
    cell['source'] = new_source.split('\n')
    cell['source'] = [line + '\n' for line in cell['source'][:-1]] + [cell['source'][-1]]
    
    # Save
    with open(NB_PATH, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1, ensure_ascii=False)
    
    print("✓ Updated NB05 cell 11:")
    print("  - Replaced single NEN2660_HASUNIT with KNOWN_UNIT_PREDICATES list")
    print("  - Updated Step 3 to filter for any predicate in list")
    print("  - Added logging for which unit predicates were found")
    return True


if __name__ == "__main__":
    update_notebook()
