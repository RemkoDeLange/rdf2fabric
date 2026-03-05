# Architecture - Fabric RDF Translation

## Document Info
| Property | Value |
|----------|-------|
| Last Updated | 2026-03-05 |
| Status | Draft - In Review |

---

## 1. System Overview

This proof of concept explores the translation of RDF (Semantic Web) data into Microsoft Fabric Graph (Labeled Property Graph) via the Fabric Ontology API. The core challenge is that this translation requires **human decisions** — there is no 1:1 mapping between RDF and LPG paradigms.

> **Note:** NEN 2660-2 (Dutch built environment standard) is used as **test data** during development.

### 1.1 Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Decision-Centric** | Fabric App guides users through 12 modeling decisions |
| **Project-Based** | Each RDF source = saved project with reusable decisions |
| **Preview-First** | Users see sample output before committing |
| **Separation of Concerns** | UI (Fabric App) ↔ Processing (Notebooks) ↔ Storage (Lakehouse) |

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE (Shared Codebase)                     │
│                                                                              │
│    ┌─────────────────────────────┐    ┌─────────────────────────────────┐   │
│    │     WEB APP (Option A)      │    │    DESKTOP APP (Option B)       │   │
│    │  Azure Static Web App       │    │    Electron (Win/Mac/Linux)     │   │
│    │  Browser-based access       │    │    Download from GitHub         │   │
│    └─────────────────────────────┘    └─────────────────────────────────┘   │
│                         \                    /                               │
│                          \                  /                                │
│                    ┌──────────────────────────────────────┐                  │
│                    │        SHARED REACT APP               │                  │
│                    │  ┌──────────┐ ┌──────────┐ ┌───────┐ │                  │
│                    │  │ Projects │ │ Decisions│ │Preview│ │                  │
│                    │  └──────────┘ └──────────┘ └───────┘ │                  │
│                    │  ┌──────────────────────────────────┐│                  │
│                    │  │    Graph Visualization           ││                  │
│                    │  │    (React Flow / Cytoscape)      ││                  │
│                    │  └──────────────────────────────────┘│                  │
│                    └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Fabric REST API (Entra SSO)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROCESSING LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      SPARK NOTEBOOKS                                     ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  ││
│  │  │  RDF Parser  │ │   Schema     │ │  Translator  │ │    Preview     │  ││
│  │  │  & Analyzer  │ │  Discovery   │ │   Engine     │ │   Generator    │  ││
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      DATA PIPELINES                                      ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                     ││
│  │  │    Ingest    │ │   Transform  │ │    Load      │                     ││
│  │  │   Pipeline   │→│   Pipeline   │→│   Pipeline   │                     ││
│  │  └──────────────┘ └──────────────┘ └──────────────┘                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER (OneLake)                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         LAKEHOUSE                                        ││
│  │  ┌─────────────────────────┐    ┌─────────────────────────────────────┐ ││
│  │  │        Files/           │    │           Tables/                   │ ││
│  │  │  ┌───────────────────┐  │    │  ┌──────────┐  ┌──────────────────┐ │ ││
│  │  │  │ config/projects/  │  │    │  │  nodes_* │  │     edges_*      │ │ ││
│  │  │  │ (JSON configs)    │  │    │  │  (Delta) │  │     (Delta)      │ │ ││
│  │  │  ├───────────────────┤  │    │  └──────────┘  └──────────────────┘ │ ││
│  │  │  │ source/ (shortcut)│  │    │  ┌──────────┐  ┌──────────────────┐ │ ││
│  │  │  │ → ws-ont_nen2660  │  │    │  │ metadata │  │     preview      │ │ ││
│  │  │  ├───────────────────┤  │    │  │  tables  │  │     samples      │ │ ││
│  │  │  │ logs/             │  │    │  └──────────┘  └──────────────────┘ │ ││
│  │  │  └───────────────────┘  │    └─────────────────────────────────────┘ ││
│  │  └─────────────────────────┘                                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OUTPUT (Fabric Graph)                               │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │       FABRIC ONTOLOGY        │  │           FABRIC GRAPH               │ │
│  │  (Schema/Model Definition)   │  │    (Queryable Property Graph)        │ │
│  └──────────────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Journey & Components

### 2.1 User Journey Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER JOURNEY                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │    1    │    │    2    │    │    3    │    │    4    │    │    5    │    │
│  │ PROJECT │───▶│ DISCOVER│───▶│ DECIDE  │───▶│ PREVIEW │───▶│ EXECUTE │    │
│  │  SETUP  │    │ SCHEMA  │    │ OPTIONS │    │ OUTPUT  │    │   RUN   │    │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│       │              │              │              │              │          │
│       ▼              ▼              ▼              ▼              ▼          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │ Create  │    │ Analyze │    │ All 12  │    │ Sample  │    │ Trigger │    │
│  │ project │    │ RDF     │    │B-choices│    │ graph   │    │ pipeline│    │
│  │ Select  │    │ Show    │    │ + A/C   │    │ Approve │    │ Monitor │    │
│  │ source  │    │ stats   │    │ info    │    │ or edit │    │ status  │    │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fabric App Screens

| Screen | Purpose | Data Source |
|--------|---------|-------------|
| **Project List** | Manage translation projects | `Files/config/projects/*.json` |
| **Schema Explorer** | View RDF classes, properties, named graphs | Schema analysis notebook output |
| **Decision Dashboard** | All 12 B-decisions with status | Project config + canned guidance |
| **Decision Detail** | Single decision with options & examples | Dynamic: examples from source data |
| **Preview Viewer** | Sample nodes/edges with current settings | Preview generator notebook output |
| **Execution Panel** | Run pipeline, view progress | Pipeline status API |
| **Logs & Reports** | Translation results, limitations report | `Files/logs/`, output tables |

### 2.3 Decision Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RDF Translation: NEN2660-Example                    [Preview] [Execute ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🟢 SCHEMA-FIRST MODE                                                    │ │
│ │ RDFS schema detected • High confidence • 5 decisions auto-resolved     │ │
│ │ Source: normative_nen2660/nen2660-rdfs.ttl                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ SCHEMA SUMMARY                                                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │  Classes    │ │ Properties  │ │  Instances  │ │   Graphs    │            │
│ │  42 (RDFS)  │ │  87 (RDFS)  │ │   1,234     │ │      3      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────────────────────┤
│ TRANSLATION DECISIONS                                         [?] Help     │
│                                                                             │
│ ┌─ Category A: Auto-Resolved (7 items) ─────────────────────────── ✓ ────┐ │
│ │ Triple mapping • IRI normalization • Datatypes • Blank nodes • ...     │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Category B: Decisions (12 items) ─────────────── 5 auto / 7 manual ───┐ │
│ │                                                                        │ │
│ │ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │ │
│ │ │ B1: Class Encoding │ │ B2: Collections    │ │ B3: OWL/SHACL      │  │ │
│ │ │ 🟢 AUTO-RESOLVED   │ │ ○ Not set          │ │ 🟡 Hints available │  │ │
│ │ │ → Node labels      │ │                    │ │                    │  │ │
│ │ │ [Override]         │ │                    │ │                    │  │ │
│ │ └────────────────────┘ └────────────────────┘ └────────────────────┘  │ │
│ │ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │ │
│ │ │ B4: Named Graphs   │ │ B5: Namespaces     │ │ B6: Inference      │  │ │
│ │ │ ○ Not set          │ │ 🟡 Hints available │ │ 🟢 AUTO-RESOLVED   │  │ │
│ │ │                    │ │ → Prefix convention│ │ → Use subClassOf   │  │ │
│ │ └────────────────────┘ └────────────────────┘ └────────────────────┘  │ │
│ │           ... (6 more decision cards) ...                             │ │
│ │                                                                        │ │
│ │ Progress: ████████████████░░░░░░░░░░░░  7/12 resolved (5 auto + 2)    │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Category C: Limitations (8 items) ─────────────────────────── ⚠ ────┐  │
│ │ Open World Assumption • Identity Semantics • Full OWL • Inference... │  │
│ │ [View Limitations Report]                                             │  │
│ └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Alternative: Instance-Only Mode Dashboard (No RDFS)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RDF Translation: Custom Dataset                     [Preview] [Execute ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠️ INSTANCE-ONLY MODE                                                   │ │
│ │ No RDFS schema detected • Schema inferred from data • All decisions    │ │
│ │ require user input                                                      │ │
│ │ [Upload RDFS file] to improve translation quality                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ INFERRED SCHEMA (from rdf:type usage)                                       │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │  Classes    │ │ Properties  │ │  Instances  │ │   Graphs    │            │
│ │ ~23 inferred│ │ ~45 inferred│ │     892     │ │      1      │            │
│ │  ⚠️ Medium  │ │  ⚠️ Medium  │ │             │ │             │            │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────────────────────┤
│ TRANSLATION DECISIONS                                         [?] Help     │
│                                                                             │
│ ┌─ Category B: All 12 Decisions Required ────────────────────────────────┐ │
│ │                                                                        │ │
│ │ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │ │
│ │ │ B1: Class Encoding │ │ B2: Collections    │ │ B3: OWL/SHACL      │  │ │
│ │ │ ○ DECISION NEEDED  │ │ ○ DECISION NEEDED  │ │ ○ DECISION NEEDED  │  │ │
│ │ │ No schema guidance │ │                    │ │                    │  │ │
│ │ └────────────────────┘ └────────────────────┘ └────────────────────┘  │ │
│ │                                                                        │ │
│ │ Progress: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0/12 decisions made           │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Adaptive Guidance Engine

The UI adapts its guidance sequence based on the detected input scenario. This provides a **smart, context-aware experience** while preserving user freedom to navigate non-linearly.

#### Guidance State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ADAPTIVE GUIDANCE STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ Files Loaded │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ANALYZE & CLASSIFY                                 │  │
│  │  • Detect schema level (0-4)                                         │  │
│  │  • Check for named graphs → affects B4 relevance                     │  │
│  │  • Check for SKOS → affects B12 relevance                            │  │
│  │  • Check for multi-typed resources → affects B3 urgency              │  │
│  │  • Check for RDF collections → affects B2 relevance                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    COMPUTE GUIDANCE CONFIG                            │  │
│  │                                                                       │  │
│  │  For each B-decision:                                                 │  │
│  │  ┌─────────────┬────────────────┬──────────────┬───────────────────┐ │  │
│  │  │  Status     │  Visibility    │  Priority    │  Recommendation   │ │  │
│  │  ├─────────────┼────────────────┼──────────────┼───────────────────┤ │  │
│  │  │ auto        │ read-only      │ n/a          │ show default      │ │  │
│  │  │ guided      │ highlighted    │ medium       │ suggest option    │ │  │
│  │  │ manual      │ normal         │ per-decision │ none              │ │  │
│  │  │ irrelevant  │ greyed/hidden  │ n/a          │ skip              │ │  │
│  │  └─────────────┴────────────────┴──────────────┴───────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    PRIORITY QUEUE                                     │  │
│  │                                                                       │  │
│  │  1. Foundation decisions:  B1 → B6 → B8     (structure)              │  │
│  │  2. Data-driven decisions: B2, B3, B4       (if input has these)     │  │
│  │  3. Semantic decisions:    B7, B9, B10, B11 (datatypes, cardinality) │  │
│  │  4. Presentation:          B5, B12          (namespaces, display)    │  │
│  │                                                                       │  │
│  │  ★ "Recommended Next" = first uncompleted in queue                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Scenario-Specific Dashboard Behavior

| Scenario | Dashboard Adaptation |
|----------|----------------------|
| **A: Instance-only (L0)** | Warning banner; all 12 decisions prominent; "Recommended: Start with B1" badge; no auto-resolved cards |
| **B: +SKOS (L1)** | B12 auto-resolved; "SKOS detected" info; hierarchy preview available; 11 decisions remaining |
| **C: +RDFS (L2)** | 5 auto-resolved shown collapsed; "Schema-First Mode" banner; 7 decisions highlighted; B7 recommended next |
| **D: +OWL (L3)** | 7 auto-resolved; OWL limitations warning (C3); focused on B2, B4, B5; inverse properties auto-handled |
| **E: Full (L4)** | 8 auto-resolved; SHACL validation available; "Validate before translate" prompt; minimal decisions |
| **F: Schema-only** | "Schema Exploration Mode"; ontology tree view prominent; no instance decisions; "Add instance files" CTA |

#### Irrelevance Detection

Certain decisions become **irrelevant** based on input content:

| Decision | Irrelevant When | Dashboard Behavior |
|----------|-----------------|-------------------|
| B4: Named Graphs | No named graphs in input | Grey out; show "Not applicable - no named graphs detected" |
| B12: SKOS Concepts | No SKOS vocabulary in input | Grey out; show "Not applicable - no SKOS detected" |
| B2: Collections | No `rdf:List`, `rdf:Bag`, `rdf:Seq` found | Grey out or hide completely |
| B10: Inverse Props | No `owl:inverseOf` in input | Lower priority; note "No explicit inverses found" |

---

## 3. Component Architecture

### 3.1 Fabric Workspace Structure

| Workspace | Items | Purpose |
|-----------|-------|---------|
| **ws-rdf_translation-dev-01** | All development items | Development environment |

**Lakehouse: `lh_rdf_translation_dev_01`**

| Path | Content | Purpose |
|------|---------|---------|
| `Files/config/projects/` | `{project_id}.json` | Project configurations & decisions |
| `Files/source/` | Shortcut to source lakehouse | Access to RDF source files |
| `Files/logs/{project_id}/` | Execution logs | Debug and audit |
| `Tables/schema_analysis` | Parsed RDF schema info | Schema explorer data |
| `Tables/preview_nodes` | Sample translated nodes | Preview viewer data |
| `Tables/preview_edges` | Sample translated edges | Preview viewer data |
| `Tables/{project}_nodes_*` | Final node tables | Graph import source |
| `Tables/{project}_edges_*` | Final edge tables | Graph import source |

### 3.2 Notebooks

| Notebook | Purpose | Trigger |
|----------|---------|---------|
| `nb_schema_detector` | Detect schema level (0-4) and parse RDF formats | On source selection |
| `nb_schema_analyzer` | Parse RDF, extract classes/properties/stats | After schema detection |
| `nb_preview_generator` | Generate sample nodes/edges with current decisions | On preview request |
| `nb_translator` | Full translation with all decisions applied | Pipeline execution |
| `nb_ontology_loader` | Create/update Fabric Ontology and bind data | Pipeline execution |

#### Schema Detection Logic (`nb_schema_detector`)

```python
# Pseudocode for progressive schema detection
def detect_schema_level(rdf_files):
    """
    Analyze files to determine schema richness level (0-4).
    Uses progressive detection: SHACL > OWL > RDFS > SKOS > Instance-only
    
    Returns schema level with associated metadata.
    """
    # Level indicators (checked highest-first)
    level_checks = [
        (4, ['sh:NodeShape', 'sh:property', 'sh:path']),           # SHACL
        (3, ['owl:Class', 'owl:ObjectProperty', 'owl:Restriction']), # OWL
        (2, ['rdfs:Class', 'rdfs:Property', 'rdfs:domain']),        # RDFS
        (1, ['skos:ConceptScheme', 'skos:Concept', 'skos:broader']), # SKOS
    ]
    
    # Parse all files with format auto-detection
    combined_graph = Graph()
    for file in rdf_files:
        fmt = detect_format(file)  # From extension or content
        combined_graph += parse_rdf(file, format=fmt)
    
    # Check levels highest-first
    for level, indicators in level_checks:
        for indicator in indicators:
            if combined_graph.contains_predicate(indicator):
                return build_level_result(level, combined_graph)
    
    # Level 0: Instance-only
    return {
        'level': 0,
        'levelName': 'instance-only',
        'confidence': 'low',
        'warning': 'No schema detected - all 12 B-decisions require user input',
        'autoResolvedDecisions': [],
        'guidedDecisions': [],
        'manualDecisions': ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12']
    }

def detect_format(file_path):
    """Auto-detect RDF serialization format."""
    ext_map = {
        '.ttl': 'turtle', '.trig': 'trig',
        '.nt': 'nt', '.nq': 'nquads',
        '.jsonld': 'json-ld', '.json': 'json-ld',
        '.rdf': 'xml', '.xml': 'xml'
    }
    ext = Path(file_path).suffix.lower()
    return ext_map.get(ext, 'turtle')  # Default to Turtle

LEVEL_AUTO_DECISIONS = {
    4: ['B1', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12'],  # SHACL
    3: ['B1', 'B6', 'B8', 'B9', 'B10', 'B11', 'B12'],        # OWL
    2: ['B1', 'B6', 'B8', 'B11', 'B12'],                      # RDFS
    1: ['B12'],                                               # SKOS
    0: []                                                     # Instance-only
}
```

### 3.3 Pipelines

| Pipeline | Activities | Trigger |
|----------|------------|---------|
| `pl_full_translation` | Analyze → Translate → Load → Report | Manual / App-triggered |
| `pl_preview_only` | Generate preview samples only | App-triggered |

### 3.4 Project Configuration Schema

```json
{
  "projectId": "uuid",
  "name": "NEN2660 Bridge Example",
  "created": "2026-02-23T10:00:00Z",
  "updated": "2026-02-23T14:30:00Z",
  "source": {
    "workspace": "ws-ont_nen2660-dev-01",
    "lakehouse": "lh_nen2660data_dev_01",
    "paths": [
      "Files/examples_nen2660/IJsselbrug.ttl",
      "Files/examples_nen2660/Liggerbrug.ttl"
    ],
    "schemaFiles": [
      "Files/normative_nen2660/nen2660-rdfs.ttl",
      "Files/normative_nen2660/nen2660-owl.ttl"
    ],
    "formats": {
      "detected": ["turtle", "turtle"],
      "autoDetected": true
    }
  },
  "schemaRichness": {
    "level": 3,
    "levelName": "OWL Ontology",
    "confidence": "high",
    "detectedAt": "2026-02-23T10:02:00Z",
    "schemaLayers": {
      "skos": true,
      "rdfs": true,
      "owl": true,
      "shacl": false
    },
    "autoResolvedDecisions": ["B1", "B6", "B8", "B9", "B10", "B11", "B12"],
    "guidedDecisions": ["B3", "B7"],
    "manualDecisions": ["B2", "B4", "B5"]
  },
  "schemaAnalysis": {
    "classes": 42,
    "classSource": "owl:Class + rdfs:Class",
    "properties": 87,
    "propertySource": "rdfs:Property",
    "instances": 1234,
    "namedGraphs": 3,
    "lastAnalyzed": "2026-02-23T10:05:00Z"
  },
  "decisions": {
    "B1_classEncoding": {
      "choice": "nodeLabel",
      "autoResolved": true,
      "reason": "rdfs:Class definitions found",
      "overridden": false,
      "decidedAt": "2026-02-23T10:02:00Z"
    },
    "B2_collections": null,
    "B3_owlShacl": null,
    "B4_namedGraphs": null,
    "B5_namespaces": {
      "choice": "prefixConvention",
      "autoResolved": false,
      "decidedBy": "user@example.com",
      "decidedAt": "2026-02-23T11:15:00Z"
    },
    "B6_inference": {
      "choice": "useSubClassOf",
      "autoResolved": true,
      "reason": "rdfs:subClassOf hierarchy detected",
      "overridden": false,
      "decidedAt": "2026-02-23T10:02:00Z"
    },
    "B7_naryPatterns": null,
    "B8_ontologyMapping": null,
    "B9_multiValuedProps": null,
    "B10_languageTags": {
      "choice": "selectLanguage",
      "preferredLanguage": "en",
      "fallbackOrder": ["en", null, "nl"],
      "autoResolved": false,
      "decidedBy": "user@example.com",
      "note": "RDF supports multiple language tags; Fabric Ontology accepts only one value per entity"
    },
    "B11_inverseProps": null,
    "B12_skosConcepts": null
  },
  "lastExecution": {
    "pipelineRunId": "run-uuid",
    "status": "completed",
    "startedAt": "2026-02-23T14:00:00Z",
    "completedAt": "2026-02-23T14:30:00Z",
    "outputTables": ["project1_nodes_entity", "project1_edges_relationship"]
  }
}
```

---

## 4. Data Flow

### 4.1 Schema Detection Flow (First Step)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SCHEMA DETECTION & ANALYSIS                           │
│                                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────────┐ │
│  │   Source    │    │              Schema Detector                         │ │
│  │  RDF Files  │───▶│  ┌─────────────────────────────────────────────────┐ │ │
│  │  (TTL,etc)  │    │  │ Scan for: rdfs:Class, rdfs:Property, owl:Class │ │ │
│  └─────────────┘    │  │           rdfs:domain, rdfs:range, etc.         │ │ │
│                     │  └─────────────────────────────────────────────────┘ │ │
│                     └───────────────────┬─────────────────────────────────┘ │
│                                         │                                   │
│                           ┌─────────────┴─────────────┐                     │
│                           │                           │                     │
│                           ▼                           ▼                     │
│                  ┌─────────────────┐        ┌─────────────────┐            │
│                  │  SCHEMA-FIRST   │        │ INSTANCE-ONLY   │            │
│                  │                 │        │                 │            │
│                  │ ✅ RDFS found   │        │ ⚠️ No schema    │            │
│                  │ • High confidence│       │ • Infer types   │            │
│                  │ • 5 auto-decisions│      │ • 12 decisions  │            │
│                  │ • Direct mapping │       │ • Show warning  │            │
│                  └─────────────────┘        └─────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Schema Analysis Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │    │   Schema    │    │   Schema    │    │   Fabric    │
│  RDF Files  │───▶│  Analyzer   │───▶│  Analysis   │───▶│    App      │
│  (TTL,etc)  │    │  Notebook   │    │   Table     │    │  Explorer   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 4.3 Preview Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Project   │    │   Preview   │    │   Preview   │    │   Fabric    │
│   Config    │───▶│  Generator  │───▶│   Tables    │───▶│    App      │
│ (decisions) │    │  Notebook   │    │(sample data)│    │   Viewer    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 4.3 Full Translation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRANSLATION PIPELINE                                │
│                                                                             │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────────┐   │
│  │ Source  │   │ Parse   │   │ Apply   │   │ Write   │   │   Create    │   │
│  │  RDF    │──▶│  RDF    │──▶│ Decision│──▶│ Delta   │──▶│   Fabric    │   │
│  │ Files   │   │ (rdflib)│   │ Rules   │   │ Tables  │   │   Ontology  │   │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────────┘   │
│       │                           │              │               │          │
│       │                           │              │               ▼          │
│       │                           │              │        ┌─────────────┐   │
│       │                           │              └───────▶│   Fabric    │   │
│       │                           │                       │    Graph    │   │
│       │                           │                       └─────────────┘   │
│       │                           │                                         │
│       │                           │ Decisions from                          │
│       │                           │ project config                          │
│       │                           │                                         │
│       │                    ┌──────┴──────┐                                  │
│       │                    │   Project   │                                  │
│       └───────────────────▶│   Config    │                                  │
│          Source paths      │   (JSON)    │                                  │
│                            └─────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Technology Stack

### 5.1 Frontend (Shared Codebase)

| Component | Technology | Notes |
|-----------|------------|-------|
| Framework | React 18+ | Shared between web and desktop |
| UI Components | Fluent UI v9 | Microsoft design system |
| Graph Visualization | React Flow | Interactive node/edge preview |
| State Management | Zustand | Project state, decisions |
| API Client | Fabric REST API | Notebook execution, data access |
| Auth | MSAL.js | Entra ID SSO (web) / Device code (desktop) |

### 5.2 Deployment Targets

| Target | Technology | Distribution |
|--------|------------|---------------|
| Web App | Azure Static Web App | `azd up` or manual deploy |
| Desktop (Windows) | Electron | `.exe` installer via GitHub Releases |
| Desktop (macOS) | Electron | `.dmg` via GitHub Releases |
| Desktop (Linux) | Electron | `.AppImage` via GitHub Releases |

> **Note:** Both deployment targets use the same React codebase. Electron wraps the web app for desktop distribution.

### 5.3 Backend (Fabric)

| Component | Technology | Notes |
|-----------|------------|-------|
| RDF Parsing | Apache Jena (Scala) preferred, rdflib (Python) | Enterprise-grade, widest format support |
| SHACL Validation | Apache Jena SHACL / pySHACL | Pre-load validation |
| Data Processing | Spark (Scala/Python) | Distributed processing |
| Storage Format | Delta Lake | Fabric-native |
| Orchestration | Data Pipelines | Sequence notebooks |

> **Note:** Notebooks can mix Scala and Python as needed. Use Scala for heavy RDF parsing, Python for orchestration and Fabric API calls.

### 5.3 Integration Points

| Integration | Method | Purpose |
|-------------|--------|---------|
| App → Lakehouse | OneLake API | Read configs, read tables |
| App → Notebooks | Fabric REST API | Trigger notebook runs |
| App → Pipelines | Fabric REST API | Trigger pipeline runs |
| Notebooks → Lakehouse | Spark Delta | Read/write data |
| Lakehouse → Ontology | Ontology REST API | Create entity types, bind tables |
| Ontology → Graph | Automatic | Graph materializes from Ontology + bindings |

---

## 6. Fabric Items Summary

### 6.1 Workspace: ws-rdf_translation-dev-01

| Item Type | Name | Purpose |
|-----------|------|---------|
| Lakehouse | `lh_rdf_translation_dev_01` | All project data and outputs |
| Notebook | `nb_schema_analyzer` | Analyze RDF source structure |
| Notebook | `nb_preview_generator` | Generate preview samples |
| Notebook | `nb_translator` | Full translation engine |
| Notebook | `nb_ontology_loader` | Create/update Fabric Ontology |
| Ontology | `ont_{project_name}` | Entity types, relationships, data bindings |
| Pipeline | `pl_full_translation` | End-to-end translation |
| Pipeline | `pl_preview_only` | Preview generation only |

> **Note:** The user interface (web app / desktop app) runs **outside** Fabric - see Section 5 for deployment.

### 6.2 Source Workspace: ws-ont_nen2660-dev-01 (existing)

| Item Type | Name | Access Method |
|-----------|------|---------------|
| Lakehouse | `lh_nen2660data_dev_01` | Shortcut from app lakehouse |

---

## 7. Security & Access

### 7.1 Authentication
- Users authenticate via Microsoft Entra ID
- Fabric App uses delegated authentication

### 7.2 Authorization
| Role | Workspace Access | Actions |
|------|------------------|---------|
| Contributor | Full | Create/edit projects, run translations |
| Viewer | Read | View projects and results |

### 7.3 Data Access
- Source data accessed via OneLake shortcuts
- Output tables inherit workspace security

---

## 8. Deployment

### 8.1 Environments

| Environment | Workspace | Purpose |
|-------------|-----------|---------|
| Development | `ws-rdf_translation-dev-01` | Active development |
| Test | `ws-rdf_translation-test-01` | Integration testing |
| Production | `ws-rdf_translation-prod-01` | Production use |

### 8.2 Git Integration
- All notebooks and pipeline definitions in `src/` folder
- Fabric workspace connected to Git for CI/CD
- Environment-specific configs managed via deployment pipelines

---

## 9. Decision Log

| # | Decision | Choice | Rationale | Date |
|---|----------|--------|-----------|------|
| 1 | UI Technology | React (external app) | Full custom UX for decision-making | 2026-02-23 |
| 2 | Decision Flow | Dashboard overview | Users prefer seeing all decisions at once | 2026-02-23 |
| 3 | Preview | Essential | Must-have to validate before commit | 2026-02-23 |
| 4 | Project Model | Multi-project | Reuse decisions across similar sources | 2026-02-23 |
| 5 | Execution | Both app + manual | Flexibility for different workflows | 2026-02-23 |
| 6 | Target Workspace | ws-rdf_translation-dev-01 | Dedicated workspace for this application | 2026-02-23 |
| 7 | Source Data | ws-ont_nen2660-dev-01 | NEN 2660 test data already available | 2026-02-23 |
| 8 | Schema Detection | 5 levels (0-4) | Graduated automation based on richness | 2026-02-24 |
| 9 | Distribution | GitHub (open source) | External tenants can install in their env | 2026-02-24 |
| 10 | Deployment | Web + Desktop (same code) | Flexibility: Azure SWA or Electron | 2026-02-24 |
| 11 | Graph Viz | React Flow | Interactive RDF→LPG preview | 2026-02-24 |
| 12 | Workspace | Customer chooses | No auto-create, respect governance | 2026-02-24 |
