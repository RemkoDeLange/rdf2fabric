"""
Add instance-derived property discovery to NB07.

Problem: NB07 only adds schema-declared properties from silver_properties.
Qualified value properties extracted in NB05 (like heeftoppervlak_value) exist
only in the properties MAP of silver_nodes/gold_nodes and are not in the schema.

Solution: After building entity types from schema, also discover property names
from actual instance data in gold_nodes and add any new properties.
"""

import json
import os

NOTEBOOK_PATH = r"c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\07_ontology_definition_generator.ipynb"

# New cell to add after entity types are built (discovery from instance data)
INSTANCE_PROPERTY_DISCOVERY_CELL = {
    "cell_type": "code",
    "execution_count": None,
    "metadata": {},
    "outputs": [],
    "source": [
        "# === INSTANCE-DERIVED PROPERTY DISCOVERY ===\n",
        "# NB05 extracts properties like qualified values (heeftoppervlak_value, heeftoppervlak_unit)\n",
        "# which exist in the properties MAP but aren't declared in silver_properties (schema).\n",
        "# Discover these from gold_nodes and add to entity type definitions.\n",
        "\n",
        "from pyspark.sql import functions as F\n",
        "from pyspark.sql.types import ArrayType, StringType\n",
        "\n",
        "print(\"\\n=== Instance-Derived Property Discovery ===\")\n",
        "\n",
        "# Load gold_nodes with properties MAP\n",
        "df_gold_nodes = spark.table(\"dbo.gold_nodes\")\n",
        "\n",
        "# Check if properties column exists and has data\n",
        "if \"properties\" not in df_gold_nodes.columns:\n",
        "    print(\"No properties MAP column in gold_nodes - skipping instance property discovery\")\n",
        "else:\n",
        "    # Get all unique property keys across all nodes, grouped by primary label\n",
        "    # labels is an array, take first element as primary label\n",
        "    df_props_by_label = df_gold_nodes.filter(\n",
        "        F.col(\"properties\").isNotNull()\n",
        "    ).select(\n",
        "        F.col(\"labels\").getItem(0).alias(\"primary_label\"),\n",
        "        F.map_keys(F.col(\"properties\")).alias(\"prop_keys\")\n",
        "    )\n",
        "    \n",
        "    # Explode and aggregate unique property keys per label\n",
        "    df_label_props = df_props_by_label.select(\n",
        "        \"primary_label\",\n",
        "        F.explode(\"prop_keys\").alias(\"prop_name\")\n",
        "    ).distinct()\n",
        "    \n",
        "    # Collect into dictionary: label -> set of property names\n",
        "    instance_props_by_label = {}\n",
        "    for row in df_label_props.collect():\n",
        "        label = row.primary_label\n",
        "        prop = row.prop_name\n",
        "        if label not in instance_props_by_label:\n",
        "            instance_props_by_label[label] = set()\n",
        "        instance_props_by_label[label].add(prop)\n",
        "    \n",
        "    print(f\"Found instance properties for {len(instance_props_by_label)} entity labels\")\n",
        "    \n",
        "    # For each existing entity type, add any instance properties not already present\n",
        "    properties_added = 0\n",
        "    entities_enriched = 0\n",
        "    \n",
        "    for et in entity_types:\n",
        "        entity_name = et['name']\n",
        "        class_uri = et.get('class_uri', '')\n",
        "        definition = et['definition']\n",
        "        existing_props = {p['name'] for p in definition['properties']}\n",
        "        \n",
        "        # Look up instance properties for this entity (try name and common variants)\n",
        "        instance_props = set()\n",
        "        for variant in [entity_name, entity_name.lower(), entity_name.capitalize()]:\n",
        "            if variant in instance_props_by_label:\n",
        "                instance_props.update(instance_props_by_label[variant])\n",
        "        \n",
        "        # Add new properties from instance data\n",
        "        new_props = instance_props - existing_props\n",
        "        if new_props:\n",
        "            entities_enriched += 1\n",
        "            for prop_name in sorted(new_props):\n",
        "                # Generate property ID\n",
        "                prop_id = generate_id(f\"prop_{class_uri}_{prop_name}\")\n",
        "                \n",
        "                # All instance properties are strings (from MAP<STRING, STRING>)\n",
        "                new_prop = {\n",
        "                    \"id\": prop_id,\n",
        "                    \"name\": sanitize_name(prop_name),\n",
        "                    \"redefines\": None,\n",
        "                    \"baseTypeNamespaceType\": None,\n",
        "                    \"valueType\": \"String\"  # Instance MAP is always STRING values\n",
        "                }\n",
        "                definition['properties'].append(new_prop)\n",
        "                properties_added += 1\n",
        "    \n",
        "    print(f\"Added {properties_added} instance-derived properties to {entities_enriched} entity types\")\n",
        "    \n",
        "    # Show sample of enriched entities\n",
        "    if entities_enriched > 0:\n",
        "        print(\"\\nSample enriched entity types:\")\n",
        "        shown = 0\n",
        "        for et in entity_types:\n",
        "            prop_count = len(et['definition']['properties'])\n",
        "            if prop_count > 1:  # More than just 'uri'\n",
        "                prop_names = [p['name'] for p in et['definition']['properties']]\n",
        "                print(f\"  {et['name']}: {prop_names}\")\n",
        "                shown += 1\n",
        "                if shown >= 5:\n",
        "                    break\n"
    ]
}

def add_instance_property_discovery():
    """Add instance property discovery cell to NB07."""
    
    with open(NOTEBOOK_PATH, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    cells = nb['cells']
    
    # Find the cell that prints "Built X entity type definitions"
    target_index = None
    for i, cell in enumerate(cells):
        if cell['cell_type'] == 'code':
            source = ''.join(cell.get('source', []))
            if 'Built {len(entity_types)} entity type definitions' in source or 'print(f"\\nBuilt {len(entity_types)}' in source:
                target_index = i
                print(f"Found entity types statistics cell at index {i}")
                break
    
    if target_index is None:
        print("ERROR: Could not find entity types statistics cell")
        return False
    
    # Check if instance property discovery already exists
    for cell in cells:
        if cell['cell_type'] == 'code':
            source = ''.join(cell.get('source', []))
            if 'INSTANCE-DERIVED PROPERTY DISCOVERY' in source:
                print("Instance property discovery cell already exists - no changes needed")
                return True
    
    # Insert new cell after the statistics cell
    insert_index = target_index + 1
    cells.insert(insert_index, INSTANCE_PROPERTY_DISCOVERY_CELL)
    
    print(f"Inserted instance property discovery cell at index {insert_index}")
    
    # Save notebook
    with open(NOTEBOOK_PATH, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    
    print(f"Saved updated notebook: {NOTEBOOK_PATH}")
    return True


if __name__ == "__main__":
    add_instance_property_discovery()
