"""
Fix NB07 to use case-insensitive matching for instance property discovery.

The original code fails to match entity names like 'Steelgirderbridge' 
with gold_nodes labels like 'SteelGirderBridge' due to case differences.
"""

import json
from pathlib import Path

# Read the notebook
notebook_path = Path(__file__).parent.parent / "src" / "notebooks" / "07_ontology_definition_generator.ipynb"
with open(notebook_path, 'r', encoding='utf-8') as f:
    notebook = json.load(f)

# Find the cell with instance property discovery
target_cell = None
target_idx = None
for idx, cell in enumerate(notebook['cells']):
    if cell.get('cell_type') == 'code':
        source = ''.join(cell.get('source', []))
        if 'INSTANCE-DERIVED PROPERTY DISCOVERY' in source and 'instance_props_by_label' in source:
            target_cell = cell
            target_idx = idx
            break

if target_cell is None:
    print("ERROR: Could not find instance property discovery cell")
    exit(1)

print(f"Found target cell at index {target_idx}")

# Get the source lines
source_lines = target_cell['source']

# Find and replace the case-sensitive matching logic
new_source_lines = []
i = 0
while i < len(source_lines):
    line = source_lines[i]
    
    # After building instance_props_by_label, add case-insensitive lookup
    if 'print(f"Found instance properties for {len(instance_props_by_label)}' in line:
        new_source_lines.append(line)
        new_source_lines.append("    \n")
        new_source_lines.append("    # Build case-insensitive lookup for instance properties\n")
        new_source_lines.append("    instance_props_by_label_lower = {k.lower(): v for k, v in instance_props_by_label.items()}\n")
        i += 1
        continue
    
    # Replace the old variant-based lookup with case-insensitive
    if '# Look up instance properties for this entity (try name and common variants)' in line:
        new_source_lines.append("        # Look up instance properties using case-insensitive matching\n")
        i += 1
        # Skip the next few lines (instance_props = set(), for variant..., if variant..., instance_props.update)
        while i < len(source_lines):
            if 'instance_props.update(instance_props_by_label[variant])' in source_lines[i]:
                i += 1
                break
            i += 1
        # Add new case-insensitive lookup
        new_source_lines.append("        instance_props = set()\n")
        new_source_lines.append("        # Try lowercase lookup (covers PascalCase, camelCase, etc.)\n")
        new_source_lines.append("        if entity_name.lower() in instance_props_by_label_lower:\n")
        new_source_lines.append("            instance_props.update(instance_props_by_label_lower[entity_name.lower()])\n")
        continue
    
    new_source_lines.append(line)
    i += 1

# Update the cell
target_cell['source'] = new_source_lines

# Write back
with open(notebook_path, 'w', encoding='utf-8') as f:
    json.dump(notebook, f, indent=1)

print(f"Updated cell at index {target_idx}")
print("Fixed case-insensitive matching for instance property discovery")
