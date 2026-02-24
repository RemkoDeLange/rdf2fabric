# Data Sources - Fabric RDF Translation

## Document Info
| Property | Value |
|----------|-------|
| Last Updated | 2026-02-23 |
| Status | Draft |

---

## 1. Fabric Environment

### 1.1 Application Workspace (NEW - to be created)

| Property | Value |
|----------|-------|
| Workspace Name | `ws-rdf_translation-dev-01` |
| Purpose | RDF Translation Application |
| Environment | Development |

**Lakehouse: `lh_rdf_translation_dev_01`** (to be created)

| Folder/Table | Purpose |
|--------------|---------|
| `Files/config/` | Decision configurations (JSON) |
| `Files/logs/` | Translation run logs |
| `Files/temp/` | Working/intermediate files |
| `Tables/nodes_*` | Output node tables (Delta) for Graph |
| `Tables/edges_*` | Output edge tables (Delta) for Graph |
| `Shortcuts/` | Links to source data lakehouses |

### 1.2 Test Data Workspace (EXISTING)

| Property | Value |
|----------|-------|
| Workspace Name | `ws-ont_nen2660-dev-01` |
| Workspace ID | `d91a1f30-7f60-4d64-baf7-9d7db5baf580` |
| Purpose | NEN 2660-2 Test Data |

**Lakehouse: `lh_nen2660data_dev_01`**

| Property | Value |
|----------|-------|
| Lakehouse ID | `4fbefebb-9dcc-4458-9d76-39e09128044c` |
| Type | Lakehouse |

---

## 2. Test Dataset: NEN 2660-2

### 2.1 Overview

| Property | Value |
|----------|-------|
| Standard | NEN 2660-2 |
| Domain | Built Environment (Construction/Infrastructure) |
| Source Location | `lh_nen2660data_dev_01` |
| Access Method | Shortcut from app lakehouse |

### 2.2 File Structure

```
lh_nen2660data_dev_01/
├── Files/
│   ├── normative_nen2660/   # Normative schema/model definitions
│   │   ├── *.skos          # SKOS concept schemes
│   │   ├── *.rdfs          # RDFS class/property definitions
│   │   ├── *.owl           # OWL ontology
│   │   └── *.shacl         # SHACL shapes/constraints
│   │
│   ├── informative_nen2660/ # Additional representations
│   │   ├── *.trig          # TriG (Turtle + named graphs)
│   │   ├── *.jsonld        # JSON-LD
│   │   ├── *.ttl           # Turtle
│   │   └── *.rdf           # RDF/XML
│   │
│   └── examples_nen2660/    # Instance data
│       ├── bridge_1.ttl    # Bridge example 1
│       ├── bridge_2.ttl    # Bridge example 2
│       ├── road_network.ttl # Road network example
│       └── hospital.ttl    # Hospital example
```

### 2.3 NEN 2660-2 Context

NEN 2660-2 is a Dutch standard providing:
- **Methodology** for creating data models in the built environment
- **Top-level ontology** for construction/infrastructure concepts
- **Modeling patterns** for objects, properties, relationships

This makes it an ideal test case because it includes:
- Rich schema definitions (OWL/RDFS)
- Validation constraints (SHACL)
- Taxonomies (SKOS)
- Multiple real-world examples

---

## 3. Files to Analyze

### 3.1 Normative Files (Schema)

| File Type | Purpose | Translation Relevance |
|-----------|---------|----------------------|
| **RDFS** | Class hierarchy, property definitions | → Node types, edge types |
| **OWL** | Rich ontology semantics | → Partial mapping, document limitations |
| **SKOS** | Concept schemes, taxonomies | → Decision B12 (hierarchy handling) |
| **SHACL** | Shape constraints, validation | → Schema validation, Fabric Ontology |

### 3.2 Informative Files (Alternate Formats)

| Format | Extension | Notes |
|--------|-----------|-------|
| TriG | `.trig` | Test named graph handling (Decision B4) |
| JSON-LD | `.jsonld` | Test JSON-LD parsing |
| Turtle | `.ttl` | Primary format, human-readable |
| RDF/XML | `.rdf` | Legacy format support |

### 3.3 Example Files (Instance Data)

| Example | Domain | Test Focus |
|---------|--------|------------|
| Bridge 1 | Infrastructure | Basic structure translation |
| Bridge 2 | Infrastructure | Variations, edge cases |
| Road Network | Transportation | Complex relationships |
| Hospital | Building | Different domain, same model |

---

## 4. Data Volume Estimates

| Category | Files | Est. Triples | Notes |
|----------|-------|--------------|-------|
| Normative | ~4-6 | 1,000-5,000 | Schema definitions |
| Informative | ~4-6 | Same as normative | Alternate formats |
| Examples | 4 | 500-2,000 each | Instance data |
| **Total Test** | ~15 | ~10,000-15,000 | Manageable for testing |

**Note:** Production datasets could be much larger. App must support streaming/chunked processing.

---

## 5. Action Items

- [ ] Create workspace `ws-rdfapp-dev-01`
- [ ] Create lakehouse `lh_rdfapp_dev_01`
- [ ] Create shortcut to `lh_nen2660data_dev_01`
- [ ] Verify file structure matches expected layout
- [ ] Parse one TTL file to validate tooling
