"""
Update NB05 to add more SKOS schema types and improve schema filtering.

This ensures schema-level concepts (owl:Class, skos:Concept, etc.) 
don't appear as instance nodes in silver_nodes.
"""
import json

NB_PATH = r'c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\05_instance_translator.ipynb'

# Enhanced SCHEMA_TYPES with SKOS additions
NEW_SCHEMA_TYPES = '''# Schema type URIs (subjects with these types are schema, not instances)
# These are ontology-level definitions, not real-world instances
SCHEMA_TYPES = {
    # OWL types
    "http://www.w3.org/2002/07/owl#Class",
    "http://www.w3.org/2002/07/owl#ObjectProperty",
    "http://www.w3.org/2002/07/owl#DatatypeProperty",
    "http://www.w3.org/2002/07/owl#AnnotationProperty",
    "http://www.w3.org/2002/07/owl#Ontology",
    "http://www.w3.org/2002/07/owl#Restriction",
    "http://www.w3.org/2002/07/owl#NamedIndividual",  # OWL individuals used as schema
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
}'''

OLD_SCHEMA_TYPES = '''# Schema type URIs (subjects with these types are schema, not instances)
SCHEMA_TYPES = {
    "http://www.w3.org/2002/07/owl#Class",
    "http://www.w3.org/2002/07/owl#ObjectProperty",
    "http://www.w3.org/2002/07/owl#DatatypeProperty",
    "http://www.w3.org/2002/07/owl#AnnotationProperty",
    "http://www.w3.org/2002/07/owl#Ontology",
    "http://www.w3.org/2002/07/owl#Restriction",  # OWL restrictions
    "http://www.w3.org/2000/01/rdf-schema#Class",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
    "http://www.w3.org/ns/shacl#NodeShape",
    "http://www.w3.org/ns/shacl#PropertyShape",
}'''

# Load notebook as text for replacement
with open(NB_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the SCHEMA_TYPES block
if OLD_SCHEMA_TYPES in content:
    content = content.replace(OLD_SCHEMA_TYPES, NEW_SCHEMA_TYPES)
    print("✓ Updated SCHEMA_TYPES with additional types")
else:
    print("⚠ Could not find exact SCHEMA_TYPES block to replace")
    print("  Manual update may be needed")

# Save the modified notebook
with open(NB_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nEnhancements:")
print("  + owl:NamedIndividual (schema-level individuals)")
print("  + shacl:Shape (base shape type)")
print("  + skos:Concept, ConceptScheme, Collection, OrderedCollection")
