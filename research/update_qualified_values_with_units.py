"""
Update NB05 cell 11 to also extract units from NEN 2660-2 qualified values.

Previous version: extracted rdf:value only
Updated version: extracts both rdf:value AND nen2660:hasUnit as separate properties
"""
import json

NB_PATH = r'c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\05_instance_translator.ipynb'

# Enhanced cell content with unit extraction
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

# Step 3: Find nen2660:hasUnit triples on blank nodes
df_units = df_triples.filter(
    F.col("predicate") == NEN2660_HASUNIT
).select(
    F.col("subject").alias("blank_node"),
    F.col("object").alias("unit_uri"),
    F.col("graph")
)

# Step 4: Join to get qualified values with units
df_qualified_base = df_bn_links.join(
    df_rdf_values,
    ["blank_node", "graph"],
    "inner"
)

# Left join with units (not all values have units)
df_qualified = df_qualified_base.join(
    df_units,
    ["blank_node", "graph"],
    "left"
)

qualified_count = df_qualified.count()
print(f"Qualified values (rdf:value pattern): {qualified_count}")

# Step 5: Create value property rows
df_value_props = df_qualified.select(
    F.col("source_subject").alias("subject"),
    F.col("source_predicate").alias("predicate"),
    F.col("value").alias("object"),
    F.lit("literal").alias("object_type"),
    F.col("datatype"),
    F.col("lang"),
    F.col("graph")
)

# Step 6: Create unit property rows (property_name + "_unit")
df_unit_props = df_qualified.filter(
    F.col("unit_uri").isNotNull()
).select(
    F.col("source_subject").alias("subject"),
    # Append "_unit" to predicate URI for unit property
    F.concat(F.col("source_predicate"), F.lit("_unit")).alias("predicate"),
    # Extract local name from unit URI for cleaner value
    F.regexp_extract(F.col("unit_uri"), r"[#/]([^#/]+)$", 1).alias("object"),
    F.lit("literal").alias("object_type"),
    F.lit(None).cast("string").alias("datatype"),
    F.lit(None).cast("string").alias("lang"),
    F.col("graph")
)

unit_count = df_unit_props.count()
print(f"Unit properties: {unit_count}")

# Step 7: Union all properties
if qualified_count > 0:
    # Get original columns
    original_cols = df_node_props.columns
    
    # Union value properties
    df_node_props = df_node_props.union(
        df_value_props.select(original_cols)
    )
    
    # Union unit properties
    if unit_count > 0:
        df_node_props = df_node_props.union(
            df_unit_props.select(original_cols)
        )
    
    print(f"Total node property triples after qualified value extraction: {df_node_props.count()}")
    
    # Show sample qualified values
    print("\\nSample qualified values with units:")
    df_qualified.select(
        "source_subject", "source_predicate", "value", "unit_uri"
    ).filter(F.col("unit_uri").isNotNull()).show(10, truncate=60)
'''

# Load notebook
with open(NB_PATH, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Replace cell 11
cell_index = 11
nb['cells'][cell_index]['source'] = [line + '\n' for line in NEW_CELL_SOURCE.split('\n')[:-1]] + [NEW_CELL_SOURCE.split('\n')[-1]]

# Save the modified notebook
with open(NB_PATH, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print(f"✓ Updated cell {cell_index} with unit extraction")
print(f"  Now extracts: rdf:value → property value")
print(f"  Now extracts: nen2660:hasUnit → property_unit value")
