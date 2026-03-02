"""Fix the generate_id function to return string IDs instead of integers."""
import json
import re

with open('src/notebooks/07_ontology_definition_generator.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Find and update the cell with generate_id
for cell in nb['cells']:
    if cell.get('cell_type') == 'code':
        source = ''.join(cell.get('source', []))
        if 'def generate_id(seed: str) -> int:' in source:
            print('Found the cell with generate_id!')
            
            # Replace the function signature and body
            old_func = '''def generate_id(seed: str) -> int:
    """
    Generate a deterministic 64-bit integer ID from a seed string.
    Used for entity type IDs, property IDs, etc.
    
    Fabric Ontology requires 64-bit integer IDs as actual integers (not strings).
    Max signed 64-bit: 9,223,372,036,854,775,807
    
    Returns int (not str) so JSON serialization produces integer, not quoted string.
    """
    # Use SHA-256 hash and convert to 64-bit integer
    hash_bytes = hashlib.sha256(seed.encode('utf-8')).digest()
    # Take first 8 bytes (64 bits) and convert to unsigned int, then mask to signed 63-bit
    raw_int = int.from_bytes(hash_bytes[:8], byteorder='big', signed=False)
    # Mask to keep it as a positive 63-bit integer (to avoid signed overflow issues)
    int_64 = raw_int & 0x7FFFFFFFFFFFFFFF  # Max: 9,223,372,036,854,775,807
    return int_64  # Return as int, not str'''
            
            new_func = '''def generate_id(seed: str) -> str:
    """
    Generate a deterministic ID from a seed string.
    Used for entity type IDs, property IDs, etc.
    
    Fabric Ontology requires IDs to be STRINGS in the JSON payload
    (e.g., "id": "8813598896083") not integers.
    
    We use 13-digit numeric strings to match Microsoft's example format.
    """
    # Use SHA-256 hash and convert to numeric string
    hash_bytes = hashlib.sha256(seed.encode('utf-8')).digest()
    # Take first 8 bytes (64 bits) and convert to unsigned int
    raw_int = int.from_bytes(hash_bytes[:8], byteorder='big', signed=False)
    # Mask to keep it as a positive 13-digit number (like MS examples)
    int_13digit = raw_int % 10000000000000  # Max: 9,999,999,999,999
    return str(int_13digit)  # Return as STRING!'''
            
            new_source = source.replace(old_func, new_func)
            if new_source == source:
                print('Replacement failed - trying different approach')
                # Try with regex
                pattern = r'def generate_id\(seed: str\) -> int:.*?return int_64  # Return as int, not str'
                replacement = new_func
                new_source = re.sub(pattern, replacement, source, flags=re.DOTALL)
                if new_source == source:
                    print('Regex replacement also failed')
                    print('Source snippet:')
                    print(source[source.find('def generate_id'):source.find('def generate_id')+500])
                    continue
            
            # Split back into lines
            lines = new_source.split('\n')
            cell['source'] = [line + '\n' if i < len(lines) - 1 else line for i, line in enumerate(lines)]
            print('Successfully replaced generate_id function!')
            break

with open('src/notebooks/07_ontology_definition_generator.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Done - saved updated notebook')
