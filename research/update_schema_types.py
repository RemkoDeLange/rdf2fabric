"""
Update NB05 SCHEMA_TYPES by modifying the notebook JSON directly.
"""
import json
import re

NB_PATH = r'c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\05_instance_translator.ipynb'

# Load notebook
with open(NB_PATH, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Find the cell with SCHEMA_TYPES
target_cell_idx = None
for i, cell in enumerate(nb['cells']):
    source = ''.join(cell['source'])
    if 'SCHEMA_TYPES = {' in source and 'owl#Class' in source:
        target_cell_idx = i
        print(f"Found SCHEMA_TYPES definition in cell {i}")
        break

if target_cell_idx is None:
    print("ERROR: Could not find SCHEMA_TYPES cell")
    exit(1)

# New cell content with enhanced SCHEMA_TYPES
NEW_CELL_SOURCE = '''from pyspark.sql import functions as F
from pyspark.sql.types import StringType, ArrayType, MapType, BooleanType
from pyspark.sql.window import Window
import re
import hashlib

# RDF namespace constants
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label"
SKOS_PREFLABEL = "http://www.w3.org/2004/02/skos/core#prefLabel"

# Schema predicate URIs to exclude from instance data
SCHEMA_PREDICATES = {
    "http://www.w3.org/2000/01/rdf-schema#subClassOf",
    "http://www.w3.org/2000/01/rdf-schema#domain",
    "http://www.w3.org/2000/01/rdf-schema#range",
    "http://www.w3.org/2002/07/owl#equivalentClass",
    "http://www.w3.org/2002/07/owl#disjointWith",
    "http://www.w3.org/2002/07/owl#inverseOf",
}

# Schema type URIs (subjects with these types are schema, not instances)
# These are ontology/vocabulary definitions - their descriptions belong
# at the Entity Type level in Fabric Ontology, NOT as instance nodes
SCHEMA_TYPES = {
    # OWL types
    "http://www.w3.org/2002/07/owl#Class",
    "http://www.w3.org/2002/07/owl#ObjectProperty",
    "http://www.w3.org/2002/07/owl#DatatypeProperty",
    "http://www.w3.org/2002/07/owl#AnnotationProperty",
    "http://www.w3.org/2002/07/owl#Ontology",
    "http://www.w3.org/2002/07/owl#Restriction",
    "http://www.w3.org/2002/07/owl#NamedIndividual",  # Schema-level individuals
    # RDFS types
    "http://www.w3.org/2000/01/rdf-schema#Class",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
    # SHACL types
    "http://www.w3.org/ns/shacl#NodeShape",
    "http://www.w3.org/ns/shacl#PropertyShape",
    "http://www.w3.org/ns/shacl#Shape",
    # SKOS types (vocabulary/taxonomy definitions)
    "http://www.w3.org/2004/02/skos/core#Concept",
    "http://www.w3.org/2004/02/skos/core#ConceptScheme",
    "http://www.w3.org/2004/02/skos/core#Collection",
    "http://www.w3.org/2004/02/skos/core#OrderedCollection",
}

def extract_local_name(uri: str) -> str:
    """Extract local name from URI."""
    if uri is None:
        return None
    if uri.startswith("_:"):
        return uri[2:]
    if "#" in uri:
        return uri.split("#")[-1]
    if "/" in uri:
        return uri.split("/")[-1]
    return uri

def generate_node_id(uri: str, graph: str, strategy: str = None) -> str:
    """
    Generate stable node ID from URI based on B11 decision.
    
    Args:
        uri: The RDF URI
        graph: Graph context for blank nodes
        strategy: B11 decision value (local-name|label|hash|full)
                  If None, uses B11_URI_ID_GENERATION global
    
    Returns:
        Node ID string
    """
    if uri is None:
        return None
    
    # Use global setting if strategy not provided
    _strategy = strategy if strategy else B11_URI_ID_GENERATION
    
    # Blank nodes always use hash (regardless of B11 setting)
    if uri.startswith("_:"):
        combined = f"{graph}:{uri}"
        return "blank_" + hashlib.md5(combined.encode()).hexdigest()[:12]
    
    # Named nodes - apply B11 decision
    if _strategy == "full":
        # Use complete URI (may be long)
        return uri
    
    elif _strategy == "hash":
        # Always hash the URI for consistent short IDs
        return hashlib.md5(uri.encode()).hexdigest()[:16]
    
    elif _strategy == "label":
        # Use label if available (handled in separate pass)
        # Fall back to local name for now - label lookup happens later
        local = extract_local_name(uri)
        if local and len(local) <= 50:
            return local
        return hashlib.md5(uri.encode()).hexdigest()[:16]
    
    else:  # "local-name" (default)
        # Use local name (fragment or last path segment)
        local = extract_local_name(uri)
        if local and len(local) <= 50:
            return local
        return hashlib.md5(uri.encode()).hexdigest()[:16]

def sanitize_property_name(name: str) -> str:
    """Convert property name to camelCase identifier."""
    if name is None:
        return None
    cleaned = re.sub(r'[^a-zA-Z0-9]', ' ', name)
    words = cleaned.split()
    if not words:
        return "unknownProperty"
    result = words[0].lower() + ''.join(w.capitalize() for w in words[1:])
    if result and not result[0].isalpha():
        result = "p" + result
    return result

extract_local_name_udf = F.udf(extract_local_name, StringType())
generate_node_id_udf = F.udf(generate_node_id, StringType())
sanitize_property_name_udf = F.udf(sanitize_property_name, StringType())
'''

# Replace the cell source
nb['cells'][target_cell_idx]['source'] = [line + '\n' for line in NEW_CELL_SOURCE.split('\n')[:-1]] + [NEW_CELL_SOURCE.split('\n')[-1]]

# Save the modified notebook
with open(NB_PATH, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print(f"✓ Updated cell {target_cell_idx} with enhanced SCHEMA_TYPES")
print("\nAdded types:")
print("  + owl:NamedIndividual")
print("  + shacl:Shape")
print("  + skos:Concept, ConceptScheme, Collection, OrderedCollection")
print("\nDescriptions on schema classes (like Requirement, DiscreteObject)")
print("will apply at Entity Type level, not as instance nodes.")
