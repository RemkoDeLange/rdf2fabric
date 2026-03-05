# Testing Guide: F2.2, F3.2, F6.1

## Overview

These features run in **Fabric Spark environment** (not locally). Testing requires:
1. Sync notebooks to your Fabric workspace
2. Ensure test data is available in the lakehouse
3. Run notebooks with different configurations

---

## Prerequisites

### 1. Fabric Workspace Setup

| Component | Name | ID |
|-----------|------|-----|
| App Workspace | `ws-rdf_translation-dev-01` | Your workspace |
| Test Data Workspace | `ws-ont_nen2660-dev-01` | `d91a1f30-7f60-4d64-baf7-9d7db5baf580` |
| Test Lakehouse | `lh_nen2660data_dev_01` | `4fbefebb-9dcc-4458-9d76-39e09128044c` |

### 2. Environment

Ensure `env_rdf_jena` environment is published with `jena-shaded-4.10.0.jar`.

### 3. Shortcut to Test Data

Create shortcuts in your app lakehouse to the test data:
```
Files/normative_nen2660  → lh_nen2660data_dev_01/Files/normative_nen2660
Files/informative_nen2660 → lh_nen2660data_dev_01/Files/informative_nen2660
Files/examples_nen2660   → lh_nen2660data_dev_01/Files/examples_nen2660
```

---

## Test Data Matrix

| Folder | Format | Files | Use For |
|--------|--------|-------|---------|
| `normative_nen2660/` | Turtle (.ttl) | nen2660-term.ttl, nen2660-rdfs.ttl, nen2660-owl.ttl, nen2660-shacl.ttl | Schema tests, SHACL parsing |
| `informative_nen2660/` | Multiple | nen2660.ttl, nen2660.rdf, nen2660.jsonld, nen2660.trig | **Multi-format tests** |
| `examples_nen2660/` | Turtle (.ttl) | IJsselbrug.ttl, Liggerbrug.ttl, Wegennetwerk.ttl, Ziekenhuis.ttl | Instance data tests |

---

## Test Scenarios

### Test 1: F2.2 Multi-Format Parser

**Goal:** Verify each RDF format parses correctly to `bronze_triples`.

#### Test 1.1: Turtle (.ttl)
```python
# In 01_rdf_parser_jena.ipynb, configure:
INPUT_PATHS = [
    "/lakehouse/default/Files/normative_nen2660"
]
```
**Expected:** All 4 TTL files parsed, triple count > 10,000

#### Test 1.2: RDF/XML (.rdf)
```python
INPUT_PATHS = [
    "/lakehouse/default/Files/informative_nen2660"  # Contains .rdf
]
# Or filter to just RDF/XML:
INPUT_PATHS = [
    "/lakehouse/default/Files/informative_nen2660/nen2660.rdf"
]
```
**Expected:** RDF/XML detected via `detectFormat()`, triples extracted

#### Test 1.3: JSON-LD (.jsonld)
```python
INPUT_PATHS = [
    "/lakehouse/default/Files/informative_nen2660/nen2660.jsonld"
]
```
**Expected:** JSON-LD format detected, `@graph` structures parsed

#### Test 1.4: TriG (.trig)
```python
INPUT_PATHS = [
    "/lakehouse/default/Files/informative_nen2660/nen2660.trig"
]
```
**Expected:** TriG parsed with named graph support, quad `graph` column populated

#### Test 1.5: Mixed Formats (All at Once)
```python
INPUT_PATHS = [
    "/lakehouse/default/Files/informative_nen2660"
]
```
**Expected:** All files (.ttl, .rdf, .jsonld, .trig) parsed in single run

#### Verification Queries
```python
# After running notebook, verify in a new cell:

# Total triples
spark.sql("SELECT COUNT(*) as total FROM bronze_triples").show()

# Triples by source file
spark.sql("""
    SELECT source_file, COUNT(*) as triples 
    FROM bronze_triples 
    GROUP BY source_file 
    ORDER BY source_file
""").show()

# Check for errors (no rows expected)
spark.sql("""
    SELECT * FROM bronze_triples 
    WHERE subject IS NULL OR predicate IS NULL
""").show()
```

---

### Test 2: F3.2 Schema Statistics

**Goal:** Verify statistics extraction works correctly.

#### Test 2.1: Full Schema (Level 4)
```python
# First run 01_rdf_parser_jena with ALL normative files:
INPUT_PATHS = ["/lakehouse/default/Files/normative_nen2660"]

# Then run 02_schema_detector
# Expected output: Schema Level 4 (SHACL detected)
```

**Expected Statistics:**
- `classCount`: ~50+ classes
- `propertyCount`: ~30+ properties  
- `instanceCount`: 0 (schema only)
- `topLevelClasses`: List of root classes
- `classHierarchyDepth`: 3-5 levels

#### Test 2.2: Instance Data Only (Level 0)
```python
# Run 01_rdf_parser_jena with ONLY examples:
INPUT_PATHS = ["/lakehouse/default/Files/examples_nen2660"]

# Expected: Level 0 or 1 (no RDFS/OWL schema)
```

#### Test 2.3: RDFS Only (Level 2)
```python
# Parse only the RDFS file:
INPUT_PATHS = ["/lakehouse/default/Files/normative_nen2660/nen2660-rdfs.ttl"]

# Expected: Level 2 (RDFS classes detected, no OWL/SHACL)
```

#### Verification
```python
# Check JSON output
import json
with open("/lakehouse/default/Files/config/schema_statistics.json") as f:
    stats = json.load(f)
    
print(f"Schema Level: {stats.get('schemaLevel', 'unknown')}")
print(f"Classes: {stats.get('classStatistics', {}).get('classCount', 0)}")
print(f"Properties: {stats.get('propertyStatistics', {}).get('propertyCount', 0)}")
```

---

### Test 3: F6.1 SHACL Parser

**Goal:** Verify SHACL constraints are extracted correctly.

#### Test 3.1: Parse NEN 2660 SHACL
```python
# First load the SHACL file:
INPUT_PATHS = ["/lakehouse/default/Files/normative_nen2660/nen2660-shacl.ttl"]

# Run 01_rdf_parser_jena
# Then run 10_shacl_parser
```

**Expected Output:**
- NodeShapes found: > 0
- PropertyShapes with constraints
- Constraint types: minCount, maxCount, datatype, class, etc.

#### Verification
```python
# Check Delta table
spark.sql("SELECT * FROM silver_shacl_shapes LIMIT 10").show(truncate=False)

# Count shapes by target class
spark.sql("""
    SELECT target_class, COUNT(*) as constraints
    FROM silver_shacl_shapes
    WHERE target_class IS NOT NULL
    GROUP BY target_class
    ORDER BY constraints DESC
""").show()

# Check JSON output
import json
with open("/lakehouse/default/Files/config/shacl_shapes.json") as f:
    shapes = json.load(f)
    
print(f"NodeShapes: {shapes['summary']['nodeShapeCount']}")
print(f"Property Constraints: {shapes['summary']['propertyConstraintCount']}")
print(f"Constraint Types: {list(shapes['summary']['constraintTypes'].keys())}")
```

---

## Full Pipeline Test

Test the complete flow from parsing to statistics to SHACL:

### Step 1: Parse All Formats
```python
# 01_rdf_parser_jena.ipynb
INPUT_PATHS = [
    "/lakehouse/default/Files/normative_nen2660",    # TTL schema
    "/lakehouse/default/Files/informative_nen2660",   # All formats
    "/lakehouse/default/Files/examples_nen2660"       # Instance data
]
```

### Step 2: Detect Schema & Statistics
```python
# Run 02_schema_detector.ipynb
# Expected: Level 4 (all schema layers present)
```

### Step 3: Parse SHACL Shapes
```python
# Run 10_shacl_parser.ipynb
# Expected: Shapes extracted from nen2660-shacl.ttl
```

### Step 4: Verify Outputs
```python
# All tables should exist:
spark.sql("SHOW TABLES").show()

# Expected tables:
# - bronze_triples
# - silver_shacl_shapes

# Files should exist:
%ls /lakehouse/default/Files/config/
# Expected:
# - schema_statistics.json
# - shacl_shapes.json
```

---

## Troubleshooting

### "Import Error: No module named 'py4j'"
The notebook is not attached to a Spark cluster. Ensure:
1. Environment `env_rdf_jena` is selected
2. Session is started

### "File not found" errors
Check shortcut paths:
```python
%ls /lakehouse/default/Files/
```

### "Lang not found" for format
Jena JAR may not be loaded. Verify in first cell:
```python
# Should not throw error:
from com.microsoft.fabric.rdf import JenaParser
```

### Zero triples parsed
Check:
1. Input path is correct
2. Files have correct extensions
3. Files are valid RDF (try loading in Protégé)

---

## Summary Checklist

| Test | Status | Notes |
|------|--------|-------|
| F2.2: TTL parsing | ⬜ | normative_nen2660/*.ttl |
| F2.2: RDF/XML parsing | ⬜ | informative_nen2660/nen2660.rdf |
| F2.2: JSON-LD parsing | ⬜ | informative_nen2660/nen2660.jsonld |
| F2.2: TriG parsing | ⬜ | informative_nen2660/nen2660.trig |
| F2.2: Mixed formats | ⬜ | All informative_nen2660/* |
| F3.2: Level 4 detection | ⬜ | All normative files |
| F3.2: Level 0 detection | ⬜ | Examples only |
| F3.2: Statistics JSON | ⬜ | Files/config/schema_statistics.json |
| F6.1: SHACL parsing | ⬜ | nen2660-shacl.ttl |
| F6.1: Constraints table | ⬜ | silver_shacl_shapes |
| Full pipeline | ⬜ | All steps in sequence |
