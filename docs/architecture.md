# Architecture - Fabric RDF Translation

## Document Info
| Property | Value |
|----------|-------|
| Last Updated | 2026-02-23 |
| Status | Draft - In Review |

---

## 1. System Overview

This application translates RDF (Semantic Web) data into Microsoft Fabric Graph (Labeled Property Graph). The core challenge is that this translation requires **human decisions** - there is no 1:1 mapping between RDF and LPG paradigms.

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
│                              USER INTERFACE                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        FABRIC APP (React)                              │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │  Projects   │ │   Schema    │ │  Decision   │ │     Preview     │  │  │
│  │  │    List     │ │  Explorer   │ │  Dashboard  │ │    & Execute    │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ REST API / Fabric SDK
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
│ SCHEMA SUMMARY                                                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │  Classes    │ │ Properties  │ │  Instances  │ │   Graphs    │            │
│ │     42      │ │     87      │ │   1,234     │ │      3      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────────────────────┤
│ TRANSLATION DECISIONS                                         [?] Help     │
│                                                                             │
│ ┌─ Category A: Auto-Resolved (7 items) ─────────────────────────── ✓ ────┐ │
│ │ Triple mapping • IRI normalization • Datatypes • Blank nodes • ...     │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Category B: Decisions Required (12 items) ────────────────────────────┐ │
│ │                                                                        │ │
│ │ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │ │
│ │ │ B1: Class Encoding │ │ B2: Collections    │ │ B3: OWL/SHACL      │  │ │
│ │ │ ✓ Decided          │ │ ○ Not set          │ │ ○ Not set          │  │ │
│ │ │ → Node labels      │ │                    │ │                    │  │ │
│ │ └────────────────────┘ └────────────────────┘ └────────────────────┘  │ │
│ │ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │ │
│ │ │ B4: Named Graphs   │ │ B5: Namespaces     │ │ B6: Inference      │  │ │
│ │ │ ○ Not set          │ │ ✓ Decided          │ │ ○ Not set          │  │ │
│ │ │                    │ │ → Prefix convention│ │                    │  │ │
│ │ └────────────────────┘ └────────────────────┘ └────────────────────┘  │ │
│ │           ... (6 more decision cards) ...                             │ │
│ │                                                                        │ │
│ │ Progress: ████████░░░░░░░░░░░░░░░░░░░░  2/12 decisions made           │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Category C: Limitations (8 items) ─────────────────────────── ⚠ ────┐  │
│ │ Open World Assumption • Identity Semantics • Full OWL • Inference... │  │
│ │ [View Limitations Report]                                             │  │
│ └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

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
| `nb_schema_analyzer` | Parse RDF, extract classes/properties/stats | On source selection |
| `nb_preview_generator` | Generate sample nodes/edges with current decisions | On preview request |
| `nb_translator` | Full translation with all decisions applied | Pipeline execution |
| `nb_graph_loader` | Load Delta tables into Fabric Graph | Pipeline execution |

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
    "paths": ["Files/examples_nen2660/bridge_1.ttl"]
  },
  "schemaAnalysis": {
    "classes": 42,
    "properties": 87,
    "instances": 1234,
    "namedGraphs": 3,
    "lastAnalyzed": "2026-02-23T10:05:00Z"
  },
  "decisions": {
    "B1_classEncoding": {
      "choice": "nodeLabel",
      "decidedBy": "user@example.com",
      "decidedAt": "2026-02-23T11:00:00Z",
      "notes": "Using labels for query optimization"
    },
    "B2_collections": null,
    "B3_owlShacl": null,
    "B4_namedGraphs": null,
    "B5_namespaces": {
      "choice": "prefixConvention",
      "decidedBy": "user@example.com",
      "decidedAt": "2026-02-23T11:15:00Z"
    },
    "B6_inference": null,
    "B7_naryPatterns": null,
    "B8_ontologyMapping": null,
    "B9_multiValuedProps": null,
    "B10_languageTags": null,
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

### 4.1 Analysis Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │    │   Schema    │    │   Schema    │    │   Fabric    │
│  RDF Files  │───▶│  Analyzer   │───▶│  Analysis   │───▶│    App      │
│  (TTL,etc)  │    │  Notebook   │    │   Table     │    │  Explorer   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 4.2 Preview Flow

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

### 5.1 Frontend (Fabric App)

| Component | Technology | Notes |
|-----------|------------|-------|
| Framework | React | Fabric App standard |
| UI Components | Fluent UI | Microsoft design system |
| State Management | React Context / Zustand | Project state, decisions |
| API Client | Fabric SDK / REST | Notebook execution, data read |

### 5.2 Backend (Fabric)

| Component | Technology | Notes |
|-----------|------------|-------|
| RDF Parsing | rdflib (Python) | Turtle, RDF/XML, JSON-LD, TriG |
| Data Processing | PySpark | Distributed processing |
| Storage Format | Delta Lake | Fabric-native |
| Orchestration | Data Pipelines | Sequence notebooks |

### 5.3 Integration Points

| Integration | Method | Purpose |
|-------------|--------|---------|
| App → Lakehouse | OneLake API | Read configs, read tables |
| App → Notebooks | Fabric REST API | Trigger notebook runs |
| App → Pipelines | Fabric REST API | Trigger pipeline runs |
| Notebooks → Lakehouse | Spark Delta | Read/write data |
| Lakehouse → Graph | Fabric Graph binding | Import node/edge tables |

---

## 6. Fabric Items Summary

### 6.1 Workspace: ws-rdf_translation-dev-01

| Item Type | Name | Purpose |
|-----------|------|---------|
| Lakehouse | `lh_rdf_translation_dev_01` | All project data and outputs |
| Notebook | `nb_schema_analyzer` | Analyze RDF source structure |
| Notebook | `nb_preview_generator` | Generate preview samples |
| Notebook | `nb_translator` | Full translation engine |
| Notebook | `nb_graph_loader` | Load to Fabric Graph |
| Pipeline | `pl_full_translation` | End-to-end translation |
| Pipeline | `pl_preview_only` | Preview generation only |
| Fabric App | `app_rdf_translator` | User interface |

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
| 1 | UI Technology | Fabric App (React) | Full custom UX for decision-making | 2026-02-23 |
| 2 | Decision Flow | Dashboard overview | Users prefer seeing all decisions at once | 2026-02-23 |
| 3 | Preview | Essential | Must-have to validate before commit | 2026-02-23 |
| 4 | Project Model | Multi-project | Reuse decisions across similar sources | 2026-02-23 |
| 5 | Execution | Both app + manual | Flexibility for different workflows | 2026-02-23 |
| 6 | Target Workspace | ws-rdf_translation-dev-01 | Dedicated workspace for this application | 2026-02-23 |
| 7 | Source Data | ws-ont_nen2660-dev-01 | NEN 2660 test data already available | 2026-02-23 |
