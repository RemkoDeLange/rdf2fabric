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

> **Important:** NEN 2660-2 is the **test dataset** for development and validation only. The application is designed to work with **any RDF data** - users can upload their own ontologies, instance data, or connect to external RDF sources.

### 2.1 Overview

| Property | Value |
|----------|-------|
| Standard | NEN 2660-2 |
| Domain | Built Environment (Construction/Infrastructure) |
| Source Location | `lh_nen2660data_dev_01` |
| Access Method | Shortcut from app lakehouse |
| **Role** | **Test data for development - not a constraint on the application** |

### 2.2 File Structure

```
lh_nen2660data_dev_01/
├── Files/
│   ├── normative/                          # Schema/model definitions (authoritative)
│   │   ├── nen2660-term.ttl               # Terms vocabulary (SKOS)
│   │   ├── nen2660-rdfs.ttl               # Classes & Properties (RDFS)
│   │   ├── nen2660-owl.ttl                # Ontology (OWL)
│   │   └── nen2660-shacl.ttl              # Validation shapes (SHACL)
│   │
│   ├── informative/                        # Same content, alternate formats
│   │   ├── nen2660.trig                   # TriG (Turtle + named graphs)
│   │   ├── nen2660.jsonld                 # JSON-LD
│   │   ├── nen2660.ttl                    # Turtle (combined)
│   │   └── nen2660.rdf                    # RDF/XML
│   │
│   └── examples/                           # Instance data (nen2660-term namespace)
│       ├── IJsselbrug.ttl                 # Bridge example (IJssel bridge)
│       ├── Liggerbrug.ttl                 # Bridge example (beam bridge)
│       ├── Wegennetwerk.ttl               # Road network example
│       └── Ziekenhuis.ttl                 # Hospital building example
```

### 2.3 File Inventory Detail

#### Normative Files (Schema Layers)

| File | Content Type | Schema Layer | Auto-Resolves |
|------|--------------|--------------|---------------|
| `nen2660-term.ttl` | SKOS ConceptScheme | **Level 1** | Labels, hierarchy roots |
| `nen2660-rdfs.ttl` | RDFS Classes/Properties | **Level 2** | Node types, edge types, domains/ranges |
| `nen2660-owl.ttl` | OWL Ontology | **Level 3** | Equivalences, restrictions (partial) |
| `nen2660-shacl.ttl` | SHACL Shapes | **Level 4** | Cardinality, validation rules |

Each layer **builds on** previous layers - RDFS imports SKOS terms, OWL imports RDFS, SHACL references OWL.

#### Informative Files (Format Variants)

| File | Format | Named Graphs | Notes |
|------|--------|--------------|-------|
| `nen2660.trig` | TriG | ✓ Yes | Tests B4 (Named Graph strategy) |
| `nen2660.jsonld` | JSON-LD | Via `@graph` | JSON-native consumers |
| `nen2660.ttl` | Turtle | ❌ No | Human-readable, combined |
| `nen2660.rdf` | RDF/XML | ❌ No | Legacy XML tooling |

**Purpose:** Demonstrate format flexibility - same semantic content in multiple serializations.

#### Example Files (Instance Data)

| File | Domain | Namespace | Physical/Spatial |
|------|--------|-----------|------------------|
| `IJsselbrug.ttl` | Infrastructure | `nen2660-term:` | Bridge over IJssel river |
| `Liggerbrug.ttl` | Infrastructure | `nen2660-term:` | Beam/girder bridge type |
| `Wegennetwerk.ttl` | Transportation | `nen2660-term:` | Road network topology |
| `Ziekenhuis.ttl` | Building | `nen2660-term:` | Hospital facility |

**All examples** use the `nen2660-term` namespace and reference concepts from the normative vocabulary.

### 2.4 NEN 2660-2 Context

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

## 3. Schema Richness Levels

The application detects **how much schema information** is available, which determines how many decisions can be auto-resolved vs requiring user input.

### 3.1 Level Definitions

| Level | Available | Detection | Auto-Resolves |
|-------|-----------|-----------|---------------|
| **0** | Instance data only | No `rdfs:`, `owl:`, `skos:`, `sh:` predicates | Nothing - full B-decision wizard |
| **1** | SKOS vocabulary | `skos:ConceptScheme`, `skos:Concept` | B12 (hierarchy), labels |
| **2** | RDFS schema | `rdfs:Class`, `rdfs:Property`, `rdfs:domain/range` | B1, B6, B8, B11, B12 (5 of 12) |
| **3** | OWL ontology | `owl:Class`, `owl:ObjectProperty`, restrictions | Level 2 + equivalences, disjointness |
| **4** | SHACL shapes | `sh:NodeShape`, `sh:property`, cardinality | Level 3 + validation, cardinality hints |

### 3.2 Progressive Schema Detection

```
┌─────────────────────────────────────────────────────────────┐
│  Parse Input Files                                          │
├─────────────────────────────────────────────────────────────┤
│  Scan for schema predicates:                                │
│                                                             │
│  sh:NodeShape found?  ─────────────────────────► Level 4    │
│         │ no                                                │
│         ▼                                                   │
│  owl:Class found?     ─────────────────────────► Level 3    │
│         │ no                                                │
│         ▼                                                   │
│  rdfs:Class found?    ─────────────────────────► Level 2    │
│         │ no                                                │
│         ▼                                                   │
│  skos:Concept found?  ─────────────────────────► Level 1    │
│         │ no                                                │
│         ▼                                                   │
│  Instance data only   ─────────────────────────► Level 0    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 B-Decision Impact by Level

| Decision | Level 0 | Level 1 | Level 2 | Level 3 | Level 4 |
|----------|---------|---------|---------|---------|---------|
| B1. Node Type Strategy | ⚪ Manual | ⚪ Manual | 🟢 Auto | 🟢 Auto | 🟢 Auto |
| B2. Blank Node Handling | ⚪ Manual | ⚪ Manual | ⚪ Manual | ⚪ Manual | ⚪ Manual |
| B3. Multi-Type Resources | ⚪ Manual | ⚪ Manual | ⚪ Manual | 🟡 Hints | 🟡 Hints |
| B4. Named Graph Strategy | ⚪ Manual | ⚪ Manual | ⚪ Manual | ⚪ Manual | ⚪ Manual |
| B5. Language Tag Handling | ⚪ Manual | ⚪ Manual | ⚪ Manual | ⚪ Manual | ⚪ Manual |
| B6. Edge Type Derivation | ⚪ Manual | ⚪ Manual | 🟢 Auto | 🟢 Auto | 🟢 Auto |
| B7. Datatype Coercion | ⚪ Manual | ⚪ Manual | 🟡 Hints | 🟡 Hints | 🟢 Auto |
| B8. Property Attachment | ⚪ Manual | ⚪ Manual | 🟢 Auto | 🟢 Auto | 🟢 Auto |
| B9. Edge vs Property | ⚪ Manual | ⚪ Manual | 🟡 Guided | 🟢 Auto | 🟢 Auto |
| B10. Inverse Properties | ⚪ Manual | ⚪ Manual | ⚪ Manual | 🟢 Auto | 🟢 Auto |
| B11. URI → ID Generation | ⚪ Manual | 🟡 Labels | 🟡 Labels | 🟡 Labels | 🟡 Labels |
| B12. Hierarchy Strategy | ⚪ Manual | 🟢 Auto | 🟢 Auto | 🟢 Auto | 🟢 Auto |

**Legend:** 🟢 Auto-resolved, 🟡 Guided/Hints, ⚪ Manual decision required

---

## 4. User Input Scenarios

Users may provide different combinations of files. The app must handle all scenarios gracefully.

### 4.1 Scenario Matrix

| Scenario | Files Provided | Schema Level | User Decisions | Use Case |
|----------|----------------|--------------|----------------|----------|
| **A** | Examples only | Level 0 | All 12 B-decisions | Ad-hoc data, no schema |
| **B** | Examples + SKOS terms | Level 1 | 11 B-decisions | Vocabulary but no types |
| **C** | Examples + RDFS | Level 2 | 7 B-decisions | Standard semantic data |
| **D** | Examples + RDFS + OWL | Level 3 | 5 B-decisions | Rich ontology |
| **E** | Full (all files) | Level 4 | 3-4 B-decisions | Complete dataset |
| **F** | Schema only (no instances) | Level 2-4 | Preview mode | Schema exploration |

### 4.2 Format Flexibility

Users may provide data in any supported RDF format. The app auto-detects format from:
1. File extension (`.ttl`, `.trig`, `.jsonld`, `.rdf`, `.nt`, `.nq`)
2. Content sniffing (if extension unclear)

| Format | Extension(s) | Named Graphs | Notes |
|--------|--------------|--------------|-------|
| Turtle | `.ttl` | ❌ | Default, human-readable |
| TriG | `.trig` | ✓ | Turtle + named graphs |
| N-Triples | `.nt` | ❌ | Line-oriented, streaming |
| N-Quads | `.nq` | ✓ | N-Triples + graphs |
| JSON-LD | `.jsonld`, `.json` | Via `@graph` | JSON-native |
| RDF/XML | `.rdf`, `.xml` | ❌ | Legacy XML |

### 4.3 Multi-File Input

When users provide **multiple files**, the app:
1. **Merges** all triples into unified graph
2. **Detects** highest schema level across all files
3. **Identifies** separate instance vs schema content
4. **Handles** namespace conflicts (warn user)

---

## 5. Data Volume Estimates

| Category | Files | Est. Triples | Notes |
|----------|-------|--------------|-------|
| Normative | 4 | 1,000-5,000 | Schema definitions |
| Informative | 4 | Same as normative | Alternate formats |
| Examples | 4 | 500-2,000 each | Instance data |
| **Total Test** | 12 | ~10,000-15,000 | Manageable for testing |

**Note:** Production datasets could be much larger. App must support streaming/chunked processing.

---

## 6. Action Items

- [ ] Create workspace `ws-rdf_translation-dev-01`
- [ ] Create lakehouse `lh_rdf_translation_dev_01`
- [ ] Create shortcut to `lh_nen2660data_dev_01`
- [ ] Verify file structure matches expected layout
- [ ] Parse one TTL file to validate tooling
