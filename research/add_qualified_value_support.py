"""
Modify NB05 to add qualified value extraction for NEN 2660-2 pattern.

NEN 2660-2 uses qualified values (blank nodes with rdf:value):
    zh:AlleVerhuurbareOppervlakken zh:heeftOppervlak [
        rdf:value 1600.0 ;
        nen2660:hasUnit unit:M2
    ] .

This script inserts a new cell after the basic property extraction
to also capture these qualified values.
"""
import json
import sys

NB_PATH = r'c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\05_instance_translator.ipynb'

# New cell content for qualified value extraction
NEW_CELL_SOURCE = '''# NEN 2660-2 Qualified Value Extraction
# Handle reified values with rdf:value pattern:
# ?subject ?property [ rdf:value ?value ; nen2660:hasUnit ?unit ]

RDF_VALUE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#value"
NEN2660_HASUNIT = "https://w3id.org/nen2660/def#hasUnit"

# Step 1: Find blank node objects connected via any predicate
df_bn_links = df_instance_triples.filter(
    F.col("object").startswith("_:")
).select(
    F.col("subject").alias("source_subject"),
    F.col("predicate").alias("source_predicate"),
    F.col("object").alias("blank_node"),
    F.col("graph")
)

# Step 2: Find rdf:value triples on blank nodes
df_rdf_values = df_triples.filter(
    F.col("predicate") == RDF_VALUE
).select(
    F.col("subject").alias("blank_node"),
    F.col("object").alias("value"),
    F.col("datatype"),
    F.col("lang"),
    F.col("graph")
)

# Step 3: Join to get qualified values
df_qualified = df_bn_links.join(
    df_rdf_values,
    ["blank_node", "graph"],
    "inner"
).select(
    F.col("source_subject").alias("subject"),
    F.col("source_predicate").alias("predicate"),
    F.col("value").alias("object"),
    F.lit("literal").alias("object_type"),
    F.col("datatype"),
    F.col("lang"),
    F.col("graph")
)

qualified_count = df_qualified.count()
print(f"Qualified values (rdf:value pattern): {qualified_count}")

# Step 4: Union with existing node properties
if qualified_count > 0:
    df_node_props = df_node_props.union(
        df_qualified.select(df_node_props.columns)
    )
    print(f"Total node property triples after qualified value extraction: {df_node_props.count()}")
    
    # Show sample qualified values
    print("\\nSample qualified values:")
    df_qualified.select("subject", "predicate", "object", "datatype").show(10, truncate=60)
'''

# Load notebook
with open(NB_PATH, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Find the position - insert after cell 10
insert_position = 11

# Create new cell
new_cell = {
    "cell_type": "code",
    "metadata": {
        "vscode": {"languageId": "python"}
    },
    "source": NEW_CELL_SOURCE.split('\n'),
    "outputs": [],
    "execution_count": None
}

# Fix source to include newlines properly
new_cell["source"] = [line + '\n' for line in NEW_CELL_SOURCE.split('\n')[:-1]] + [NEW_CELL_SOURCE.split('\n')[-1]]

# Insert the new cell
nb['cells'].insert(insert_position, new_cell)

# Save the modified notebook
with open(NB_PATH, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print(f"✓ Inserted qualified value extraction cell at position {insert_position}")
print(f"  Total cells now: {len(nb['cells'])}")
