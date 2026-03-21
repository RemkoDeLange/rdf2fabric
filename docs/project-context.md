# Project Context - Fabric RDF Translation

## Session Summary
**Date:** 2026-03-20  
**Project:** fabric_rdf_translation  
**Location:** `C:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation`

---

## Latest Updates (Mar 20)

### Sprint Completion: ~90% (11/12 B-Decisions Implemented)

**Decision Logic Implemented:**
| Decision | Notebook | Status |
|----------|----------|--------|
| B1: Node Type Strategy | NB03 | ✅ class/predicate/uri_pattern |
| B2: Blank Node Handling | NB05 | ✅ generate/inline/skolemize |
| B3: Multi-Type Resources | NB05 | ✅ primary/first/duplicate |
| B4: Named Graph Strategy | NB05 | ✅ property/partition/ignore |
| B5: Language Tag Handling | NB04 | ✅ suffix/preferred/array |
| B6: Edge Type Derivation | NB04 | ✅ property_name/domain_range |
| B7: Datatype Coercion | NB06 | ✅ strict/string/infer |
| B8: Property Attachment | - | ⬜ Not implemented (low priority) |
| B9: Edge vs Property | NB04 | ✅ all_edges/enum_properties |
| B10: Inverse Properties | NB04 | ✅ materialize/single_direction |
| B11: URI → ID Generation | NB05 | ✅ local_name/label/hash |
| B12: Hierarchy Strategy | NB03 | ✅ flatten/preserve/inherit |

### Qualified Value Extraction (Mar 19-20)

**Enhancement:** NB05 now extracts values from NEN 2660-2's qualified value pattern:
```
:x :hasProperty [ rdf:value "42.0" ; nen2660:hasUnit qudt:M ] .
```

**Multi-Standard Unit Support:** Expanded unit predicate detection:
- `https://w3id.org/nen2660/def#hasUnit` (NEN 2660-2)
- `http://qudt.org/schema/qudt/unit` (QUDT 2.x)
- `http://qudt.org/schema/qudt/hasUnit` (QUDT variant)
- `http://schema.org/unitCode` (Schema.org)

### App Improvements (Mar 19)

- **NB00 running state fix:** UI now shows NB00 as "running" immediately before calling orchestrator
- **Pipeline progress:** Real-time polling of `pipeline_progress.json` file
- **Reset/Delete:** Added Reset Pipeline and Delete Project features

### F2.4 External Ontology Dereferencing ✅ Complete (Mar 21)

**Branch:** `feature/f2.4-external-ontology-dereferencing`

**Focus:** Enable "follow your nose" Linked Data pattern — automatically fetch schema from external namespace URIs.

**Completed:**
1. **NB12 (external_ontology_fetcher.ipynb):** Python notebook that reads `ontology_fetch_manifest.json` written by app, fetches ontologies via HTTP with content negotiation (`text/turtle`, `application/rdf+xml`, etc.), and caches to `Files/cache/external_ontologies/`.

2. **NB13 (ontology_enrichment.ipynb):** Python notebook that parses cached `.ttl` files using Jena (via Py4J), extracts:
   - Labels (`rdfs:label`, `skos:prefLabel`)
   - Class hierarchy (`rdfs:subClassOf`)
   - Property metadata (`rdfs:domain`, `rdfs:range`)
   - Classes and properties lists
   - Schema vs reference_data classification
   - Outputs `Files/cache/ontology_metadata.json`

3. **NB02 label integration:** Schema detector loads `ontology_metadata.json` and displays external labels with `→` markers in PREDICATE DISTRIBUTION and TYPE DISTRIBUTION.

4. **NB04 label integration:** Property mapping loads external labels and shows enrichment statistics (4,702 labels, 278 schema properties).

5. **Mount sync fix:** Added `notebookutils.fs.head()` fallback in NB12 when `/lakehouse/default/Files` mount misses recently-written files.

**Test Results:**
- 5/6 ontologies fetched (ziekenhuis 404 expected — project-local namespace)
- 4,702 labels extracted from external ontologies
- 139 classes, 278 properties, 133 hierarchy entries
- NB02/NB04 successfully display external labels in Fabric environment

**Key Finding:** QUDT quantitykind/unit (4,100+ labels) define instances, not classes. Classified as `reference_data` (not `schema`).

**Design Decision (R19):** External ontology property inheritance NOT implemented. See R19 in decisions table.
- NEN 2660-2 defines 93 properties on 26 abstract classes
- Fabric Ontology API requires single entityTypeId (no polymorphism)
- Data-driven approach in NB07 already works correctly
- Schema hierarchy captured for documentation/display only

---

## RDF Implementation Decisions Log

Tracking specific RDF-related implementation decisions encountered during development. These are more granular than the 12 B-decisions and inform future UI/configuration options.

| ID | Decision | Options | Current Choice | Rationale | B-Decision | Status |
|----|----------|---------|----------------|-----------|------------|--------|
| R1 | **Language preference** | Any ISO 639-1 code | `en` (English) | Fabric Ontology accepts single value per entity; RDF supports multi-language | B10 | ✅ Configurable |
| R2 | **External ontology dereferencing** | Dereference URIs / Use local only | Dereference + cache | Fetch external ontologies (NEN 2660, QUDT, W3C Time), cache in OneLake, extract labels for display enrichment | - | ✅ F2.4 Complete |
| R3 | **Class discovery sources** | Explicit only / Include property ranges | Include ranges + domains | Many classes only appear as property ranges, not explicit declarations | B1 | ✅ Implemented |
| R4 | **Duplicate triple handling** | Keep all / Deduplicate | Keep all (track provenance) | `graph` column tracks source; user can deduplicate downstream | - | ✅ Implemented |
| R5 | **OWL property type URIs** | Short form / Full URI | Full URI in bronze | `http://www.w3.org/2002/07/owl#ObjectProperty` preserved; normalized in silver | B8 | ✅ Implemented |
| R6 | **Case sensitivity for lookups** | Case-sensitive / Insensitive | Case-insensitive | Different layers may use different casing (e.g., `Bridge` vs `bridge`) | - | ✅ Implemented |
| R7 | **Blank node handling** | Filter out / Include with stable ID | Include with `_:label` | Blank nodes represent valid data; stable ID enables joins | B1 | ✅ Implemented |
| R8 | **SHACL constraint storage** | Discard / Store as metadata | Store in silver_constraints | Capture now for future enforcement via Fabric Rules API | B3 | ⬜ Phase 2 (F6.3) |
| R9 | **Multi-valued properties** | First value / Array / Separate rows | TBD | Fabric Ontology may have limitations; needs investigation | B9 | ⬜ Not started |
| R10 | **Inverse properties** | Materialize both / Store one direction | TBD | `owl:inverseOf` - should we create bidirectional edges? | B11 | ⬜ Not started |
| R11 | **Named graph handling** | Flatten / Preserve as property | TBD | Named graphs lost in LPG; could preserve as edge/node property | B4 | ⬜ Not started |
| R12 | **rdf:type materialization** | Node label / Property / Both | Node label | `rdf:type ex:Bridge` → node labeled `Bridge`; no separate `type` property | B1 | ✅ Implemented |
| R13 | **Blank nodes as entity types** | Include / Filter out | Filter out | Blank nodes (`_:`) are structural (restrictions, lists, reification), not domain concepts; unstable IDs; can't be externally referenced | B1 | ✅ Implemented |
| R14 | **Label language fallback** | Preferred only / Fallback to any / Show original | Fallback with warning | When preferred language label missing, use any available; notebook logs warnings for visibility | B10 | ✅ Implemented |
| R15 | **Missing domain/range** | Leave open / Infer from instances / Flag for review | Leave open | Properties without `rdfs:domain`/`rdfs:range` are skipped in edge creation (cannot determine source node type). **Known limitation:** Properties like `designLifespan`, `length`, `width` may be defined in ontology but have no declared domain - these become orphaned. Future: F7.10 UI to assign domains manually, or Phase 2 instance-based inference. | B2 | ✅ Implemented |
| R16 | **Implicit SHACL class targeting** | Explicit only / Include implicit (SHACL 2.1.3) | Include implicit | Per SHACL spec 2.1.3, a NodeShape that is also an `owl:Class` or `rdfs:Class` implicitly targets itself. NEN 2660-2 uses this pattern (e.g., `nen2660:Activity a owl:Class, sh:NodeShape`). Parser now detects both explicit `sh:targetClass` and implicit class-as-shape targeting. | B3 | ✅ Implemented |
| R17 | **Instance-driven relationship types** | Schema-only / Instance-driven fallback / Hybrid | Instance-driven | Schema defines abstract predicates (e.g., `hasFunctionalPart`) but instance data uses concrete predicates (e.g., `hasPart`). NB07 now fully discovers edge types from `gold_edges.type` and infers source/target entity types from actual edge data. | B2, B8 | ✅ Complete |
| R18 | **Orphan edge targets** | Accept gap / Catch-all entity type / Fix instance extraction | **Catch-all AdHocEntity** | SQL analysis found 157 orphan IDs (edge endpoints with no gold table). Orphans have NO properties in bronze_triples (only appear as edge targets). Solution: Add `AdHocEntity` type with `id` + `label` columns. **Achieved:** 161 entities, 70 relationships, 71 edge bindings. | B1, B2 | ✅ Complete |
| R19 | **External ontology property inheritance** | Inherit relationships from abstract classes / Data-driven only | **Data-driven only** | External ontologies (NEN 2660-2) define 93 properties on 26 abstract classes (e.g., `isConnectedTo` on `PhysicalObject`). **Evaluated options:** (A) Generate relationship types for all type pairs — exponential complexity (15 subtypes × 15 = 225 rel types per property); (B) Generic `relatesTo` — loses semantic meaning; (C) Data-driven — only create relationships that exist in instance data. **Decision:** Option C. Fabric Ontology requires `source: {entityTypeId}`, `target: {entityTypeId}` — single IDs, not arrays. No polymorphism support. Instance-driven discovery in NB07 already handles this correctly. The external schema hierarchy is captured in `ontology_metadata.json` for future use (display, documentation) but does not drive Fabric Ontology structure. | B2, B8 | ✅ Complete |
| R20 | **B11 "Use rdfs:label" + label property coexistence** | Skip label property when B11=label / Keep both / Deprecate B11 label option | **Keep both** | B11 offers "Use rdfs:label" to set node IDs to human-readable labels. F2.4 added a `label` property on all entities with `displayNamePropertyId` pointing to it. When B11="label", the node ID and `label` property contain the same value (minor redundancy). **Decision:** Keep both. The `label` property provides consistent GQL access (`n.label`) regardless of B11 setting. Minor redundancy is acceptable for API predictability. | B11 | ✅ Complete |

### Adding New Decisions
When you encounter a new RDF-specific implementation choice:
1. Add a row with `⬜` status
2. Document options considered
3. Note which B-decision it relates to (if any)
4. Update status when implemented or deferred

---

## Project Background

This project is a **proof of concept** exploring what it takes to import RDF (Semantic Web) data into Microsoft Fabric Real-Time Intelligence (Ontology + Graph). It investigates the translation challenges between RDF and Labeled Property Graphs, the modeling decisions required, and the current capabilities and limitations of Fabric's Ontology and Graph APIs. NEN 2660-2 (Dutch built environment standard) is used as test data to exercise the full pipeline.

---

## Decisions Made

### 1. Local-First Development Approach ✅
- **Decision:** Build the application locally with a structured folder approach
- **Rationale:** 
  - Enables version control with Git
  - Supports code review workflows (PR-based)
  - Full VS Code IDE capabilities
  - CI/CD ready for multi-environment deployments (Dev → Test → Prod)

### 2. Git Repository Initialized ✅
- **Decision:** Initialize Git early, during requirements gathering phase
- **Rationale:** Track requirements evolution, enable collaboration, nothing lost

### 3. Project Structure ✅
```
fabric_rdf_translation/
├── .git/                     # Version control
├── .github/                  # GitHub Actions CI/CD
│   └── workflows/
├── .gitignore                # Fabric-optimized ignore rules
├── README.md                 # Project overview
│
├── docs/                     # Documentation
│   ├── requirements.md       # Business & technical requirements
│   ├── architecture.md       # System design (diagram included)
│   ├── data-sources.md       # Source systems & RDF mappings
│   └── project-context.md    # This file
│
├── src/
│   ├── fabric/               # Fabric items (notebooks, pipelines)
│   │   ├── notebooks/        # Spark notebooks
│   │   └── pipelines/        # Data pipelines
│   │
│   └── app/                  # Shared React application
│       ├── src/              # React components, hooks, services
│       ├── electron/         # Electron main process (desktop wrapper)
│       └── package.json      # Dependencies, build scripts
│
└── infra/                    # Azure deployment (azd template)
    ├── main.bicep            # Azure Static Web App definition
    └── azure.yaml            # azd configuration
```

### 4. Fabric Workspace Strategy ✅
- **Decision:** Create a new dedicated workspace `ws-rdf_translation-dev-01`
- **Rationale:** 
  - Clean separation from existing workspaces
  - Follows established naming convention
  - Isolated development environment for RDF translation

### 5. Source Data Location ✅
- **Source Workspace:** `ws-ont_nen2660-dev-01`
- **Lakehouse:** `lh_nen2660data_dev_01`
- **Data Structure:**
  - `Files/normative_nen2660/` - Normative NEN 2660 ontology (SKOS, RDFS, OWL, SHACL)
  - `Files/informative_nen2660/` - Informative NEN 2660 content (format variants)
  - `Files/examples_nen2660/` - Example RDF data (IJsselbrug, Liggerbrug, etc.)

### 6. User Interface Architecture ✅
- **Technology:** Fabric App (React) - full custom UI for decision-making
- **Navigation:** Dashboard overview - see all 12 B-decisions at once
- **Preview:** Essential - must see sample nodes/edges before final import
- **Project Model:** Multi-project - each RDF source = saved project with decisions
- **Execution:** Both app-triggered and manual pipeline run supported

### 7. Primary Users ✅
- **Knowledge Graph Specialist** + **Business Analyst** collaborate on decisions
- **Data Engineer** implements and maintains the solution

### 8. Schema Richness Levels ✅
- **Decision:** Application detects 5 levels of schema richness (not binary)
- **Levels:**
  | Level | Available | User Decisions | Example Use Case |
  |-------|-----------|----------------|------------------|
  | 0 | Instance data only | All 12 B-decisions | Ad-hoc data export |
  | 1 | SKOS vocabulary | 11 B-decisions | Taxonomy/vocabulary |
  | 2 | RDFS schema | 7 B-decisions | Standard semantic data |
  | 3 | OWL ontology | 5 B-decisions | Rich ontology |
  | 4 | SHACL shapes | 3-4 B-decisions | Full validation |
- **Detection:** Progressive - check for SHACL first, then OWL, RDFS, SKOS
- **Rationale:** Different schema richness enables different levels of automation; allows more precise guidance to users about what's auto-resolved vs. manual

### 9. Generic Application (Domain-Agnostic) ✅
- **Decision:** Application is fully generic - works with **any** RDF data/ontology
- **Scope:** DBpedia, schema.org, FIBO, SNOMED, custom ontologies, etc.
- **Test Data:** NEN 2660-2 is used for development/validation only, not a constraint
- **Rationale:** Maximize reusability; don't hardcode domain-specific assumptions; all domain-specific handling comes from user's schema files

### 10. Adaptive Guidance Sequencing ✅
- **Decision:** Application intelligently adapts guidance sequence based on input scenario
- **Behavior:**
  - Analyzes input files to detect schema level + content patterns (named graphs, SKOS, collections)
  - Marks decisions as: auto-resolved, guided, manual, or irrelevant
  - Computes priority queue: B1 → B6 → B8 (foundation) → data-driven → semantic → presentation
  - Shows "Recommended Next" badge on highest-priority uncompleted decision
  - Greys out or hides irrelevant decisions (e.g., B4 if no named graphs)
- **User Freedom:** Non-linear navigation preserved - users can still click any decision
- **Rationale:** Reduce cognitive load; focus user on what matters for their specific data; avoid overwhelming with irrelevant options

### 11. Dual Deployment Model (Web + Desktop) ✅
- **Decision:** Ship both a web app and desktop app from the **same React codebase**
- **Distribution:**
  | Component | Technology | How Users Get It |
  |-----------|------------|------------------|
  | Fabric Backend | Notebooks, Pipelines | GitHub → Fabric Git integration import |
  | Web App | Azure Static Web App | `azd up` or manual deploy to their Azure |
  | Desktop App | Electron | Download from GitHub Releases (`.exe`, `.dmg`, `.AppImage`) |
- **Target Audience:** External organizations (different Entra tenants)
- **Why Both:**
  - Web App: Good for teams, shared URL, developers familiar with Azure
  - Desktop App: Simpler for enterprise users (no Azure deployment needed)
- **Auth:**
  - Web: Entra ID SSO (redirect flow)
  - Desktop: Entra ID device code flow (works cross-tenant)
- **Graph Visualization:** React Flow for interactive RDF → LPG preview
- **Rationale:** Maximize adoption by offering installation flexibility; same codebase means no extra maintenance

### 12. Customer Workspace Choice ✅
- **Decision:** Customer chooses which Fabric workspace to use (app does NOT auto-create)
- **Setup Flow:**
  1. Customer creates or chooses an existing Fabric workspace
  2. Customer connects workspace to GitHub (Git integration) to import notebooks/pipelines
  3. Customer configures the workspace URL in the app on first run
- **What Gets Installed:**
  | Item | Type | Purpose |
  |------|------|----------|
  | `nb_schema_analyzer` | Notebook | Detect schema richness |
  | `nb_preview_generator` | Notebook | Generate preview data |
  | `nb_translator` | Notebook | RDF → Delta translation |
  | `nb_graph_loader` | Notebook | Load to Fabric Graph |
  | `pl_full_translation` | Pipeline | End-to-end orchestration |
  | `pl_preview_only` | Pipeline | Preview only |
  | `lh_rdf_translation` | Lakehouse | Auto-created by notebooks |
- **Why Customer Chooses:**
  - No elevated permissions needed (app doesn't create workspaces)
  - Customer controls where their data lives
  - Works with existing Fabric governance
  - Flexible: use dedicated workspace or add to existing
- **Rationale:** Respect customer's Fabric environment; avoid permission escalation; support various governance models

### 13. RDF to LPG Translation Layer ✅
- **Decision:** Build translation layer because Fabric Graph does NOT support RDF natively
- **Finding:** Fabric Graph uses **Labeled Property Graph (LPG)** model, not RDF triples
- **Translation Mapping:**
  | RDF/OWL Concept | LPG Equivalent |
  |-----------------|----------------|
  | `owl:Class` | Node Type (label) |
  | `owl:DatatypeProperty` | Node Property |
  | `owl:ObjectProperty` | Edge Type |
  | `rdfs:domain` | Edge source node type |
  | `rdfs:range` | Edge target / property type |
  | `rdf:type` | Node label assignment |
- **Workflow:**
  1. Parse RDF with rdflib (Python)
  2. Validate with pySHACL (optional)
  3. Translate to LPG structure
  4. Write to Lakehouse as Delta tables
  5. Generate Graph Model JSON definition
  6. Create/update Fabric Graph via REST API
- **Implications:**
  - No native OWL, RDFS, or SHACL support in Fabric
  - Schema evolution not supported (requires new Graph Model version)
  - Service principal auth not available (preview limitation)
- **Full details:** [research-spike-results.md](research-spike-results.md)
- **Rationale:** Fabric Graph is the target; RDF is the source; translation layer bridges the gap

### 14. GitHub Repository & Fabric Workspace Setup ✅
- **Decision:** Project infrastructure established
- **GitHub Repository:** https://github.com/RemkoDeLange/rdf2fabric
- **Fabric Workspace:** `ws-rdf_translation-dev-01`
- **Git Integration:** Fabric workspace connected to GitHub, syncing `/fabric` folder
- **Branch:** `main`
- **App Name:** RDF2Fabric
- **Rationale:** Public GitHub enables open-source distribution; Fabric Git integration enables CI/CD for notebooks/pipelines

### 15. Notebook Development Workflow 🟡
- **Decision:** Use manual notebook import during prototyping phase
- **Current Approach:**
  - Develop notebooks locally in VS Code
  - Manual import to Fabric for testing
  - Fabric is "source of truth" for working code
  - Local repo captures design intent
- **Switch to Git Sync When:**
  - Notebooks become production artifacts (scheduled pipelines, user-facing)
  - Second developer joins the project
  - Separate dev/test/prod workspaces are created
  - Notebooks need deployment across multiple workspaces
- **Trigger Flag:** Copilot will flag when these conditions are met
- **Rationale:** P0 notebooks are proving out the translation flow; may be replaced by GUI app or evolve into reusable pipeline components; premature sync creates maintenance overhead

### 16. Fabric Ontology as Target (Not Graph Model) ✅
- **Decision:** Use Fabric Ontology item as the target, not direct Graph Model JSON
- **Architecture:**
  ```
  silver_node_types  ─┐
  silver_properties  ─┼──► Ontology Definition ──► REST API ──► Fabric Ontology
  gold_nodes         ─┤                                              │
  gold_edges         ─┘                                              ▼
                                                              Fabric Graph (automatic)
  ```
- **Why Ontology over Graph Model:**
  - Ontology is a first-class Fabric item with dedicated REST API
  - Automatic Graph materialization when Ontology is bound to data
  - Data Agent support for natural language queries (NL2Ontology)
  - Future: Rules and reasoning at the Ontology layer
  - Better alignment with semantic web concepts (entity types ≈ classes)
- **REST API:**
  - `POST /v1/workspaces/{id}/ontologies` - Create Ontology item
  - `POST /ontologies/{id}/updateDefinition` - Push entity types, properties, relationships
  - `POST /ontologies/{id}/getDefinition` - Retrieve current definition
- **Data Binding:** Entity types bind to Lakehouse tables (gold_nodes), relationships bind to edges (gold_edges)
- **Rationale:** Native integration path, better tooling support, enables Agentic AI scenarios

---

## Current Status

� **Phase: Requirements Complete → Implementation Ready**

**Completed:**
- [x] Project folder structure created
- [x] Git repository initialized
- [x] Documentation templates in place
- [x] Business problem documented
- [x] Decision framework defined (3 categories: A/B/C)
- [x] Fabric technical requirements researched
- [x] Source data identified (NEN 2660-2 in `ws-ont_nen2660-dev-01`)
- [x] UX requirements defined (Fabric App, dashboard, preview)
- [x] Architecture document drafted
- [x] Schema richness levels defined (0-4 graduated detection)
- [x] Test data file structure documented
- [x] User input scenarios defined (A-F)
- [x] Adaptive guidance sequencing defined
- [x] Performance requirements defined
- [x] Compliance requirements defined
- [x] CI/CD strategy defined (GitHub Actions + Fabric deployment pipelines)
- [x] Multi-environment workspace strategy defined
- [x] Distribution model defined (Web + Desktop from shared codebase)
- [x] Customer workspace choice defined (app does not auto-create)

**Pending (Next Phase):**
- [x] Reorganize src/ folder structure for new layout
- [x] **Complete research spike (Fabric Ontology API)** → See [research-spike-results.md](research-spike-results.md)
- [x] Create development Fabric workspace (`ws-rdf_translation-dev-01`)
- [x] Create GitHub repository (https://github.com/RemkoDeLange/rdf2fabric)
- [x] Connect Fabric workspace to GitHub (folder: `/fabric`)
- [x] **Scaffold React app with Electron support** (F7.1)
- [x] **Create lakehouse with folder structure** (F1.2)
- [x] **Create shortcuts to NEN 2660 test data** (F1.3)

**In Progress:**
- [ ] **R18: Catch-all AdHocEntity type** — Day 1-2 of 2-week sprint
- [ ] F5.4 Graph Materialization - clean slate ontology rebuild in progress

**Investigated (Documented):**
- [x] Edge coverage gap root cause identified: orphan target nodes (R18)
- [x] `haspart` (72 edges, 39%) targets don't exist in gold tables — data completeness issue, not Fabric limitation
- [x] SQL analysis: 157 orphan IDs, orphans have NO properties in bronze_triples

**2-Week Sprint (Mar 9-23):**
- [ ] Week 1: R18 fix + backend integration (workspace config, file browser)
- [ ] Week 2: Decision Dashboard UI + demo polish
- [ ] Demo goal: Scenario A (12 decisions) vs Scenario E (3-4 decisions) contrast

---

## Session: 2026-03-09 - Sprint Start: R18 Catch-All Entity Type 🔄 IN PROGRESS

**Topics:** Implementing AdHocEntity to capture orphan edge targets, 2-week demo sprint planning

### Sprint Goal

Demo application showing Scenario A (data only, 12 decisions) vs Scenario E (full schema, 3-4 decisions) contrast.

### R18 Implementation Plan

**Problem:** 157 orphan node IDs appear in edges but have no gold table entries.

**SQL Analysis Results:**
- Query 1: 157 orphan IDs (edge endpoints not in any gold table)
- Query 2: 123 unique target_ids not in gold tables
- Query 3: **Orphans have NO properties in bronze_triples** (they only appear as edge objects)

**Solution:** Add `AdHocEntity` catch-all entity type:

| Component | Change |
|-----------|--------|
| NB05 | Extract orphan IDs from edges, assign `AdHocEntity` label |
| NB06 | Create `gold_adhocentity` table with `id`, `label` columns |
| NB07 | Add `AdHocEntity` to Ontology definition |
| NB09 | Bind `gold_adhocentity` to GraphModel |

**Expected Results:**
| Metric | Before | After |
|--------|--------|-------|
| Gold table nodes | ~11 | ~168 |
| Queryable edges | ~25 | ~170+ |
| Edge coverage | 13% | **90%+** |

### Files to Modify

1. `src/notebooks/05_instance_translator.ipynb` — Extract orphan nodes
2. `src/notebooks/06_delta_writer.ipynb` — Write gold_adhocentity table
3. `src/notebooks/07_ontology_definition_generator.ipynb` — Add AdHocEntity type
4. `src/notebooks/09_data_binding.ipynb` — Bind AdHocEntity to GraphModel

---

## Session: 2026-03-07b - Instance-Driven Edge Types & Schema/Data Mismatch ✅ ROOT CAUSE FOUND

**Topics:** Edge queries return only 13% of data — discovered schema/instance predicate mismatch, implemented instance-driven relationship types

### Problem Discovery

After implementing schema-first edge naming (F4.3) and running the full pipeline, Graph queries returned edges but only for 4 of 16 edge types:

| Metric | Count |
|--------|-------|
| Edge types in gold_edges | 16 |
| Edge types in GraphModel | 7 |
| Edge types with data in Graph | **4** |
| Edges queryable | ~25 of 185 (**13%**) |

### Root Cause Analysis

**Issue 1: Schema vs Instance Predicate Mismatch**

The NEN 2660-2 schema defines abstract predicates, but instance data uses different concrete predicates:

| Schema Defines | Instance Uses | Edges |
|----------------|---------------|-------|
| `hasFunctionalPart` | `hasPart` | 72 |
| (various) | `broader` | 57 (SKOS) |
| (various) | `seeAlso` | 11 |

The schema-first edge naming in NB05 falls back to data-driven naming correctly, but NB09's GraphModel builder only creates edge types from schema-derived relationship types.

**Issue 2: GraphModel Edge Type Filtering**

NB09 skips edge types where:
- Source/target entity types are abstract classes with no instance data
- Source/target node labels don't match any entity type name

This caused 38 schema relationship types to be skipped (correct — no instance data) but also excluded instance-derived types.

### Solution Implemented

Added instance-driven relationship type discovery to NB09:

1. **New cells after "Analyze Gold Tables":**
   - Discover edge types from `gold_edges.type` not in schema relationship_types
   - Infer source/target entity types from actual edge data (most common labels)
   - Create new relationship type definitions

2. **Updated binding assembly:**
   - Include instance-derived relationship type definition parts in `updateDefinition` payload
   - Generate relationship contextualizations for instance-derived types

### Results After Fix

| Metric | Before | After |
|--------|--------|-------|
| Missing from schema | 7 | 7 |
| Instance-derived created | 0 | 5 |
| Still missing (SKOS) | 0 | 2 (`broader`, `hastopconcept`) |
| GraphModel edge types | 2 | 7 |

**SKOS edge types skipped:** `broader` and `hastopconcept` connect `Concept`/`ConceptScheme` nodes which don't have corresponding entity types. Acceptable for PoC.

### Current Graph Query Results

```sql
-- Working edge types in Graph
MATCH ()-[e]->()
RETURN DISTINCT LABELS(e) AS edge_type
```

Results: `seealso`, `connectsport`, `connectsobject`, `member`

**Missing:** `consistsof`, `haspart` (72 edges), and 9 others

### Root Cause: Orphan Target Nodes ✅ IDENTIFIED

Deep investigation via SQL revealed the true root cause:

**`gold_edges` table structure has no entity type information:**
```
COLUMN_NAME | DATA_TYPE
source_id   | varchar
target_id   | varchar
type        | varchar
```

**`haspart` edge statistics:**
| Metric | Value |
|--------|-------|
| Total `haspart` edges | 72 |
| Unique source IDs | 26 |
| Unique target IDs | 71 |
| **Gold table nodes (total)** | **~11** |

**The target nodes don't exist in any gold table.** Example:
```sql
-- Source exists:
SELECT id FROM gold_bridgedeck WHERE id = 'BridgeDeck_1'  → ✅ Found

-- Target doesn't exist in ANY gold table:
id = 'AllSameLongitudinalBulbStiffeners'  → ❌ Not found
id = 'SteelPlate_deck'                     → ❌ Not found  
id = 'Pillar_F'                            → ❌ Not found
```

**Why targets are orphaned:**
1. NB05 (instance translator) creates nodes only for instances with recognized `rdf:type`
2. These "part" objects (stiffeners, plates, pillars) either:
   - Have no explicit `rdf:type` in the RDF data
   - Have types not in the schema (e.g., domain-specific subtypes)
3. NB06 only creates gold tables for entity types that exist in silver_nodes

**This is a data completeness gap, not a Fabric/Graph limitation.**

### Options for Improvement (Phase 2)

| Option | Effort | Result |
|--------|--------|--------|
| **A. Accept limitation** | None | PoC shows working edges where both nodes exist (4 types, ~25 edges) |
| **B. Add catch-all entity type** | Medium | Create `gold_adhoc` or `gold_unknown` for nodes without recognized types |
| **C. Fix NB05 to capture all instances** | Higher | Trace RDF to find why targets lack types; may require SPARQL analysis |

**Decision for PoC:** Option A — Accept limitation with documentation. The 4 working edge types prove the end-to-end pipeline works. The `haspart` gap demonstrates a real RDF challenge (type inference) that would be documented as a known limitation.

### Previous Analysis (Superseded)

~~Only 4 edge types have data in the Graph despite 7 edge types defined in GraphModel.~~

| GraphModel Edge Type | gold_edges.type | Match? |
|---------------------|-----------------|--------|
| aggregationstatetype | (none) | ❌ |
| hasfunctionalpart | (none - data has `haspart`) | ❌ |
| seealso | seealso | ✅ |
| connectsobject | connectsobject | ✅ |
| connectsport | connectsport | ✅ |
| consistsof | consistsof | ✅ (but not in query) |
| member | member | ✅ |

### Files Changed

- `src/notebooks/09_data_binding.ipynb`:
  - Added markdown cell: "Instance-Driven Relationship Types (F4.3 Extension)"
  - Added python cell: Discover edge types from gold_edges, infer source/target, create relationship types
  - Added python cell: Create Ontology definition parts for instance-derived types
  - Updated binding assembly cell to include instance definition parts
  - Updated summary output

- `docs/backlog.md`:
  - F5.3 acceptance criteria: Added "Instance-driven relationship types" checkbox

### Key Learning

**Fabric GraphModel has two separate concerns:**
1. **Ontology relationship types** — Schema layer, generic source/target entity types
2. **GraphModel edge types** — Data layer, specific source/target node type pairs

Creating an Ontology relationship does NOT automatically create a GraphModel edge type. The GraphModel builder filters based on whether source/target entity types have instance data in gold tables.

**Open World Semantics:**
The instance-driven approach aligns with RDF open world semantics — if a predicate is used in data but not defined in schema, we create a type for it rather than rejecting the data.

### Next Steps

- [x] ~~Investigate why `consistsof`, `haspart`, and others still missing from Graph queries~~ → Root cause: orphan target nodes
- [ ] Document edge coverage limitation in architecture.md
- [ ] Consider Phase 2: catch-all entity type for untyped instances
- [ ] Consider Phase 2: improve NB05 to extract all subjects/objects as nodes (not just typed instances)

---

## Session: 2026-03-10 - RefreshGraph Observations ✅ DOCUMENTED

**Topics:** GraphModel item creation vs Graph data population; RefreshGraph job behavior observations

### Terminology

We use these terms to distinguish between two distinct operations:

| Term | Meaning |
|------|---------|
| **GraphModel item creation** | The GraphModel item appearing in the Fabric workspace (metadata/shell) |
| **Graph data population** | Nodes and edges becoming queryable via GQL (via RefreshGraph) |

### What We Confirmed

| Behavior | Status |
|----------|--------|
| "Ontology creation triggers Graph creation" (GraphModel item appears) | ✅ Confirmed |
| Graph materialization (actual data) requires explicit steps | ✅ Confirmed |

**Graph materialization requires:**
1. Building GraphModel definition (`dataSources`, `graphType`, `graphDefinition`)
2. Uploading via `updateDefinition` API
3. Triggering `RefreshGraph` job

### Observations (2026-03-10)

| Step | Observation |
|------|-------------|
| Ontology created | GraphModel item appeared ✓ |
| Immediate RefreshGraph | Status = **Cancelled** |
| After uploading `graphDefinition` + RefreshGraph | Status = **Succeeded**, data queryable |

**Additional observation:** When running NB09 Step 4 (RefreshGraph trigger), a job was already running. This job (`9da70b1a`) completed successfully. Our explicit trigger (`1eb01181`) was cancelled.

### Possible Explanations (Inconclusive)

The **Cancelled** status and the "already running" job could be due to:

| Possibility | Explanation |
|-------------|-------------|
| ❓ `updateDefinition` auto-triggers RefreshGraph | Undocumented behavior — we can't confirm |
| ❓ A previous notebook run | Job may have been from earlier execution |
| ❓ Timing/race condition | We may have triggered too quickly |
| ❓ Concurrent operation from another source | Something else in the system |

**Note:** We do NOT have conclusive evidence that `updateDefinition` auto-triggers RefreshGraph. Our data is inconclusive.

### NB09 Update (2026-03-10)

Changed Step 4 to be more robust:

**New behavior:**
1. Check for running RefreshGraph jobs
2. If found: wait for completion (don't trigger new one)
3. If none running: trigger explicit RefreshGraph
4. Poll until completion

This avoids double-triggering and handles both scenarios (whether auto-trigger exists or not).

### Communicated to Fabric Product Team

Our observations were shared with the product team:
- Ontology creation → GraphModel item appears (automatic) ✅
- Graph data population → requires explicit `updateDefinition` + `RefreshGraph`
- Observed "Cancelled" status on early RefreshGraph attempts (explained by ConcurrentOperation)

---

## Session: 2026-03-07 - RefreshGraph ConcurrentOperation Root Cause ✅ RESOLVED

**Topics:** Microsoft support clarified RefreshGraph cancellation is NOT a bug — ConcurrentOperation behavior

### Summary

Microsoft support analyzed the RefreshGraph job cancellations and determined the root cause: **ConcurrentOperation** — a previous RefreshGraph job was still running when subsequent jobs were triggered, causing Fabric to automatically cancel them.

### Key Finding

| Previous Status | Actual Status |
|-----------------|---------------|
| RefreshGraph bug (instant cancel) | **NOT A BUG** — ConcurrentOperation behavior |
| Service-side limitation | User-triggered job overlap |

**From support dashboard:**
- Job `ff8de413...` was still running (active)
- All follow-up jobs (`9ca54d06...`, `f56f1843...`, etc.) cancelled due to `GraphRefreshSnapshot.UserError.ConcurrentOperation`

### Solution Implemented

1. **Clean slate approach:** Deleted existing corrupted ontology (160 entities, 40 relationships, 115 bindings) and GraphModel
2. **Added concurrency handling:** New `wait_for_running_graph_jobs()` function checks for running jobs before triggering RefreshGraph
3. **Extended timeout:** Full graph refresh can take 30+ minutes; increased wait timeout from 5 min to 30 min

### Files Changed

- `research/refresh_workaround.py` — Created new script with 3-phase approach (cleanup, inspect, rename workaround)
- `research/update_nb09_timeout.py` — Helper script to update NB09 timeout configuration
- `src/notebooks/09_data_binding.ipynb` — Added `wait_for_running_graph_jobs()` with extended timeouts:
  - 30 minute timeout waiting for running jobs
  - 30 second polling interval
  - 60 minute max wait for new RefreshGraph job completion

### Timeout Parameters (NB09 Step 4)

| Parameter | Old | New |
|-----------|-----|-----|
| Wait for running jobs timeout | 5 min | **30 min** |
| Polling interval | 30 sec | 30 sec |
| Max wait for new job | ~30 min | **60 min** |

### Next Steps

- [ ] Sync updated NB09 to Fabric workspace
- [ ] User to complete running NB01-NB08 in Fabric
- [ ] Run NB09 with concurrency handling
- [ ] Verify graph materialization succeeds

---

## Session: 2026-03-04e - RefreshGraph Cancelled Investigation 🔴 BLOCKED

**Topics:** RefreshGraph job cancels instantly without error — appears to be service-side limitation

### Summary

GraphModel `updateDefinition` (Step 3) now succeeds consistently, storing all 5 required parts. However, `RefreshGraph` (Step 4) immediately cancels (<1 second) with no `failureReason` provided.

### Investigation Steps

| Test | Result |
|------|--------|
| Fetch GraphModel definition | ✅ All 5 parts present (graphType, dataSources, graphDefinition, stylingConfiguration, .platform) |
| Verify data lakehouse ID | ✅ Correct: `32e17923-0b8b-4106-953a-6d63081fa361` |
| Verify OneLake path format | ✅ `abfss://52fc996f-...@onelake.dfs.fabric.microsoft.com/32e17923-.../Tables/dbo/gold_container` |
| Check gold_container table | ⚠️ Only `id` column populated, `properties` MAP empty for all rows |
| Test minimal id-only GraphModel | ❌ RefreshGraph cancelled |
| Test with entityTypeId reference | ❌ RefreshGraph cancelled |
| Path without `dbo/` prefix | ❌ Validation error (dbo/ required) |

### RefreshGraph LRO Response

```json
{
  "status": "Cancelled",
  "createdTimeUtc": "2026-03-04T16:45:23.123Z",
  "lastUpdatedTimeUtc": "2026-03-04T16:45:23.456Z",
  "failureReason": null
}
```

**Key observation:** `startTime` ≈ `endTime` (same second) — job terminates instantly without attempting any work.

### Minimal Test Definition

Even this minimal definition fails:
```json
// graphDefinition.json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphDefinition/1.0.0/schema.json",
  "nodeTables": [{
    "name": "Container_nodeTable",
    "nodeType": "Container_nodeType",
    "dataSource": "gold_container",
    "nodeIdColumn": "id",
    "nodeIdColumnType": "String",
    "columnMappings": [{
      "columnDataType": "String",
      "columnName": "id",
      "property": "uri"
    }]
  }],
  "edgeTables": []
}
```

### Root Cause Analysis

| Possible Cause | Verdict |
|----------------|---------|
| Bad GraphModel definition | ❌ Ruled out — updateDefinition succeeds, 5 parts stored |
| Wrong lakehouse ID | ❌ Ruled out — verified matches data lakehouse |
| OneLake path format | ❌ Ruled out — validated format, dbo/ required |
| Missing properties in table | ⚠️ Possible but id-only mapping also fails |
| Service-side preview limitation | **Likely** — no error details, instant cancel |
| Capacity/region restriction | **Possible** — Graph may not be GA in all regions |

### Data Quality Issue (Separate from RefreshGraph)

The `gold_container` table has empty `properties` MAP:
```
id                                              | properties
nen2660:Container                               | {}
urn:nen2660:concept:Container:containedElement  | {}
... (6 rows, all empty)
```

This is an upstream issue from notebooks 01-05 — property extraction from RDF was not implemented. However, even minimal id-only GraphModel definitions fail RefreshGraph.

### Recommendations

1. **File support ticket** with `rootActivityId` from RefreshGraph response
2. **Try Fabric Portal UI** — Graph may only refresh through UI, not API
3. **Check capacity settings** — verify Graph is enabled in workspace capacity
4. **Test in different region** — this may be a preview region limitation

### Files Changed

None — investigation only, no code fixes possible for service-side issue.

### Next Steps

- [ ] File Microsoft support ticket with rootActivityId
- [ ] Try RefreshGraph from Fabric Portal UI (not API)
- [ ] Check if Graph workload is enabled in capacity admin settings
- [ ] Investigate upstream property extraction (notebooks 01-05)

---

## Session: 2026-03-04d - GraphModel API Root Cause Found ✅ RESOLVED

**Topics:** ModelValidationError on GraphModel updateDefinition — systematic API testing revealed root causes

### Problem

NB09 Step 3 (GraphModel updateDefinition) consistently failed with:
```
errorCode: ModelValidationError
message: Invalid input. Please check the provided data and try again.
```

Even the "empty definition" test that previously worked started failing.

### Investigation

Created `research/graphmodel_api_test.py` to systematically test API variations:
1. Empty definition (baseline) — **initially passed, then failed**
2. 1 dataSource only — **failed**
3. Full definition with nodeType/nodeTable — **failed**

### Root Causes Found (via direct API testing)

| Issue | Fix |
|-------|-----|
| **Missing `$schema` in all JSON files** | Every JSON part must include `$schema` URL |
| **dataSources.json structure** | Must be `{"$schema": "...", "dataSources": [...]}` — NOT just the array `[...]` |
| **positions/styles must be objects** | Use `{}` not `[]` in stylingConfiguration |
| **visualFormat required** | Include `"visualFormat": null` in stylingConfiguration |
| **Table paths are CASE SENSITIVE** | `gold_container` not `gold_Container` — Spark/Delta lowercases table names |

### Correct JSON Schema URLs

```
dataSources.json:           https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/dataSources/1.0.0/schema.json
graphType.json:             https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphType/1.0.0/schema.json
graphDefinition.json:       https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphDefinition/1.0.0/schema.json
stylingConfiguration.json:  https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/stylingConfiguration/1.0.0/schema.json
.platform:                  https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json
```

### Correct dataSources.json Format

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/dataSources/1.0.0/schema.json",
  "dataSources": [
    {
      "name": "gold_container",
      "type": "DeltaTable",
      "properties": {
        "path": "abfss://...@onelake.dfs.fabric.microsoft.com/.../Tables/dbo/gold_container"
      }
    }
  ]
}
```

### Correct stylingConfiguration.json Format

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/stylingConfiguration/1.0.0/schema.json",
  "modelLayout": {
    "positions": {},
    "styles": {},
    "pan": {"x": 0.0, "y": 0.0},
    "zoomLevel": 1.0
  },
  "visualFormat": null
}
```

### Test Results After Fixes

| Test | Result |
|------|--------|
| Empty definition with correct format | ✅ SUCCESS |
| 1 dataSource (lowercase path) | ✅ SUCCESS |
| Full definition (1 nodeType + nodeTable) | ✅ SUCCESS |

### Files Changed

- `src/notebooks/09_data_binding.ipynb` — Step 3 cell completely rewritten:
  - Added all required `$schema` URLs
  - Added `fix_datasource_path()` to lowercase table names
  - Fixed stylingConfiguration to use objects and include `visualFormat: null`
- `research/graphmodel_api_test.py` — New test script for API validation

### Key Learning

The Fabric GraphModel API validates:
1. JSON schema compliance (all files need `$schema`)
2. OneLake path existence and case-sensitivity
3. Object vs array types in specific fields

The error message "Invalid input" is generic — systematic testing with minimal payloads was needed to isolate each issue.

### Next Steps

- [ ] Replace NB09 in Fabric with updated version
- [ ] Re-run full pipeline (Steps 1-4)
- [ ] Verify Graph shows nodes and edges in Fabric portal

---

## Session: 2026-03-04c - GraphItemDefinitionIncomplete Fix

**Topics:** Missing `stylingConfiguration.json` in GraphModel definition upload

### Problem

NB09 Step 3 failed with error:
```
errorCode: GraphItemDefinitionIncomplete
message: An error occurred while processing the operation
```

The `updateDefinition` API returned 202 (accepted), then the LRO completed with status `Failed`.

### Root Cause

[Microsoft documentation](https://learn.microsoft.com/en-us/rest/api/fabric/articles/item-management/definitions/graph-model-definition) lists **4 required parts** for a GraphModel definition:

| Part | Required |
|------|----------|
| `dataSources.json` | **true** |
| `graphDefinition.json` | **true** |
| `graphType.json` | **true** |
| `stylingConfiguration.json` | **true** |

Our code was only sending 3 parts + `.platform` — missing `stylingConfiguration.json`.

### Fix

Added `stylingConfiguration.json` generation to NB09 Step 3:
- Positions: nodes arranged in a 6-column grid layout (200px spacing)
- Styles: all node and edge types get `{"size": 30}` (default)
- Layout: `pan: {0, 0}`, `zoomLevel: 1`
- Schema: includes `"schemaVersion": "1.0.0"`

```json
{
  "schemaVersion": "1.0.0",
  "modelLayout": {
    "positions": {"Bridge_nodeType": {"x": 0, "y": 0}, ...},
    "styles": {"Bridge_nodeType": {"size": 30}, ...},
    "pan": {"x": 0, "y": 0},
    "zoomLevel": 1
  }
}
```

### Files Changed
- `src/notebooks/09_data_binding.ipynb` — Added `stylingConfiguration.json` generation in Step 3, updated markdown docs and comments

### Next Steps
- [ ] Re-run NB09 in Fabric — Step 3 should now succeed
- [ ] Verify Step 4 RefreshGraph succeeds
- [ ] Verify Graph shows nodes and edges in Fabric portal

---

## Session: 2026-03-04b - Entity Type ID Mismatch Fix

**Topics:** Fabric-assigned IDs differ from locally generated IDs

### Problem

Multiple NB09 runs showed entity type IDs in the local definition file (13-digit) do not match Fabric's actual IDs (19-digit). Example:
- Local file: `5735535045641`
- Fabric UI: `8298755735535045641`

The suffix matches, but Fabric prepends additional digits. This means binding paths like `EntityTypes/{local_id}/DataBindings/...` reference IDs that don't exist in the Fabric-stored definition.

### Root Cause

1. **`generate_id()` in NB07** truncates to 13 digits: `raw_int % 10_000_000_000_000`
2. **NB09** loads entity types from the local definition file (which has our 13-digit IDs)
3. Fabric assigns its own IDs when processing the definition upload
4. Binding paths built with local IDs don't match the Fabric entity type IDs

### Fix

**NB07:** Updated `generate_id()` to use full 63-bit positive integer range (up to 19 digits):
```python
int_64 = raw_int & 0x7FFFFFFFFFFFFFFF  # Max: 9,223,372,036,854,775,807
```

**NB09:** Added a new cell after API helpers that fetches authoritative entity/relationship types from the Fabric API and overrides the local-file-loaded IDs. The API is always the source of truth. Also cleaned up debug cell with hardcoded Bridge ID comparison.

### Files Changed
- `src/notebooks/07_ontology_definition_generator.ipynb` — `generate_id()` range fix
- `src/notebooks/09_data_binding.ipynb` — API ID override cell, diagnostic cleanup

### Next Steps
- [x] Delete existing ontology + GraphModel in Fabric (old 13-digit IDs)
- [x] Re-run NB07→NB08→NB09 with new ID generation
- [x] **Test theory:** Before running GraphModel build cells, check if Fabric auto-populated the GraphModel definition. **Result: GraphModel still empty** — confirmed this is product behavior, not caused by our ID mismatch. The manual GraphModel build cells ARE needed.
- [ ] Verify Graph nodes/edges visible in Fabric portal after running GraphModel build + RefreshGraph

---

## Session: 2026-03-04 - GraphModel Definition & Graph Materialization

**Topics:** Empty Graph root cause, GraphModel definition gap, build graph definition ourselves

### Problem: Graph is Empty Despite Working Bindings

After NB07→NB08→NB09 all succeeded and 75 data bindings were visible in Fabric UI, the connected Graph remained empty.

### Root Cause

Research script `research/graph_refresh_research.py` discovered:

| Finding | Detail |
|---------|--------|
| GraphModel exists | `cadff1f3-20f6-4795-ade3-1cf42f4e87ab` (auto-created by Fabric) |
| GraphModel definition | **EMPTY** — only `.platform` metadata, no dataSources/graphType/graphDefinition |
| RefreshGraph on Ontology | `400 InvalidJobType` — not supported |
| RefreshGraph on GraphModel | `202` → immediately `Cancelled` (empty definition) |

**Root cause:** Fabric auto-creates a GraphModel shell when an Ontology is created, but does NOT populate its definition from Ontology entity types or data bindings. The GraphModel definition needs to be built and uploaded separately.

> **✅ Confirmed (2026-03-04b):** Tested with correct IDs (63-bit range, matching Fabric). GraphModel is still empty after data binding upload. This IS product behavior — the manual GraphModel definition build is required.

### Solution: Build GraphModel Definition Ourselves

Added 4 new cells to NB09 (after binding upload, before save config):

| Step | Cell | Description |
|------|------|-------------|
| 1 | `#VSC-82eaf7ba` | Discover auto-created GraphModel by name pattern |
| 2 | `#VSC-05b916a2` | Build dataSources, graphType, graphDefinition from entity types + gold tables |
| 3 | `#VSC-b16cbe29` | Assemble definition parts (base64) + upload via `updateDefinition` on GraphModel |
| 4 | `#VSC-c8e73e6e` | Trigger `RefreshGraph` + poll job until Succeeded/Failed |

**GraphModel Definition Structure:**
- `dataSources.json`: One DeltaTable per entity gold table + one for `gold_edges`
- `graphType.json`: nodeTypes (alias, labels, primaryKey=`["id"]`, all STRING properties) + edgeTypes (source/destination node type aliases)
- `graphDefinition.json`: nodeTables (1:1 column→property mappings) + edgeTables (filter `gold_edges` by `type` column per relationship)
- `stylingConfiguration.json`: UI layout positions and visual styles for all node/edge types (required by API)

### Files Changed
- `src/notebooks/09_data_binding.ipynb` — 4 new cells for GraphModel definition + updated summary
- `research/graph_refresh_research.py` — Research script (committed earlier)

### Next Steps
- [ ] Run NB09 in Fabric to test full pipeline including graph materialization
- [ ] Verify Graph shows nodes and edges in Fabric portal
- [ ] If RefreshGraph fails, debug definition format issues

---

## Session: 2026-03-03 - F5.3 Data Binding ✅ RESOLVED

**Topics:** Data binding upload via API — root cause found and fixed

**RESOLUTION:** Data binding upload works! Two issues were blocking success:

### Root Causes

1. **`getDefinition` LRO pattern was wrong**: The Fabric `POST getDefinition` always returns 202.
   After the LRO succeeds, the definition is at `{operationUrl}/result` (GET), NOT from calling
   `getDefinition` again. The old code re-called `getDefinition` which returned 202 again, meaning
   definitions were never read back — causing incorrect/missing IDs in binding payloads.

2. **Notebook 09 converts IDs back to integers**: Line `entity_id = int(entity_id)` undoes the
   string ID fix. IDs must stay as strings throughout.

### Successful Tests (via `research/data_binding_research.py`)

| Test | Description | Result |
|------|-------------|--------|
| 3 | Minimal data binding (1 entity, 1 property → gold_nodes) | ✅ PASS |
| 5 | Entity bindings + relationship contextualizations | ✅ PASS |
| 6 | Real table binding (gold_nodes.id column) | ✅ PASS |

### Verified Data Binding Structure

**Entity binding path:** `EntityTypes/{entityId}/DataBindings/{uuid}.json`
- Schema: `https://developer.microsoft.com/json-schemas/fabric/item/ontology/dataBinding/1.0.0/schema.json`
- `dataBindingConfiguration.dataBindingType`: `"NonTimeSeries"`
- `propertyBindings`: `[{sourceColumnName, targetPropertyId}]`
- `sourceTableProperties`: `{sourceType: "LakehouseTable", workspaceId, itemId, sourceTableName, sourceSchema: "dbo"}`

**Relationship binding path:** `RelationshipTypes/{relId}/Contextualizations/{uuid}.json`
- Schema: `https://developer.microsoft.com/json-schemas/fabric/item/ontology/contextualization/1.0.0/schema.json`
- `dataBindingTable`: same table properties as above
- `sourceKeyRefBindings`: `[{sourceColumnName, targetPropertyId}]` (source entity key)
- `targetKeyRefBindings`: `[{sourceColumnName, targetPropertyId}]` (target entity key)

### Key LRO Fix Pattern
```python
# CORRECT: Use {operationUrl}/result after LRO succeeds
resp = api.post(f".../getDefinition", {})            # → 202
op_url = resp.headers["Location"]                      # → https://.../v1/operations/{id}
# ... poll op_url until Succeeded ...
result = requests.get(f"{op_url}/result", headers=h)   # → 200 + definition
```

### Files Changed
- `research/data_binding_research.py` — Added `get_definition()` method with proper LRO/result handling
- `research/data_binding_findings.md` — Full research documentation

### Next Steps
- [x] Update notebook 08 with correct LRO `/result` pattern for `get_ontology_definition()`
- [x] Update notebook 09: remove `int()` conversions, keep IDs as strings
- [x] Update notebook 09: include existing definition parts alongside bindings
- [x] Update notebook 09: add `get_ontology_definition()` function
- [x] Update backlog (F5.2, F5.3) with verified API structures
- [x] Update research-spike-results.md with S7 section
- [ ] Upload bindings for full RDF_Translated_Ontology (run notebook 09 in Fabric)
- [ ] Verify bindings appear in Fabric Ontology UI
- [ ] Trigger graph refresh and inspect results

---

## Session: 2026-03-02 - F5.2/F5.3 Ontology Upload Debugging ✅ RESOLVED

**Topics:** Fabric Ontology API errors, ID format issues, reserved words

**Problem:** Ontology definition upload fails with `ALMOperationImportFailed` error.

**RESOLUTION FOUND:** IDs must be **STRINGS** in the JSON payload, not integers!

**Investigation Path:**

| Issue | Resolution |
|-------|------------|
| UUID IDs rejected | Changed to numeric IDs |
| String IDs rejected | **WRONG** - IDs MUST be strings! |
| "Must be 64 bit identifier" error | Misleading - the error is about format, not value |
| ID not found during data binding | IDs should be quoted strings like `"id": "8813598896083"` |
| ALMOperationImportFailed | **ROOT CAUSE:** Was sending unquoted integers, needed quoted strings |

**Solution (2026-03-02):**

From Microsoft documentation sample at [REST API - Update Ontology Definition](https://learn.microsoft.com/en-us/rest/api/fabric/ontology/items/update-ontology-definition):

```json
{
  "id": "8813598896083",  // STRING, not integer!
  "namespace": "usertypes",
  "entityIdParts": ["3117068036374594013"],  // STRING array!
  ...
}
```

**Key Code Change:**

`generate_id()` function updated to return `str`:
```python
def generate_id(seed: str) -> str:
    """Returns numeric string ID like "8813598896083" """
    hash_bytes = hashlib.sha256(seed.encode('utf-8')).digest()
    raw_int = int.from_bytes(hash_bytes[:8], byteorder='big', signed=False)
    int_13digit = raw_int % 10000000000000  # 13-digit number
    return str(int_13digit)  # Return as STRING!
```

**Validation:**

Research script `research/fabric_ontology_api_research.py` confirmed:
- ✅ String IDs: `{"id": "8888888888888"}` → **SUCCESS**
- ❌ Integer IDs: `{"id": 8888888888888}` → **FAIL**

**Commits:**
- `5ac22bd` - "Add 'class' to RESERVED_WORDS + fix ID types"
- `67c36b4` - "Fix: Generate string IDs instead of integers for Fabric Ontology API"

**Next Steps:**
1. Sync notebooks from GitHub to Fabric workspace
2. Re-run notebook 07 to regenerate entity types with string IDs
3. Re-run notebook 08 to upload ontology
4. Complete F5.3 data binding

---

## Key Decisions Summary

See **Decisions Made** section above for numbered canonical decisions (1-14).
See **Session Archive** section below for dated session logs.

---

## Session Archive

### Session: 2026-03-09 - R18 Complete: 161 Entities, 70 Relationships ✅

**Topics:** R18 AdHocEntity implementation, relationship name uniqueness, full pipeline run

**Achievements:**

| Metric | Before | After |
|--------|--------|-------|
| Entity types | 17 | **161** |
| Relationship types | 7 | **70** |
| Node bindings | 11 | **76** |
| Edge bindings | 4 | **71** |

**Issues Fixed:**

1. **`haspart` edges missing (39% of edges)** → Root cause: Schema-driven relationship building in NB07 looked for gold tables that didn't exist. Fix: Instance-driven discovery from `gold_edges` + `gold_nodes`.

2. **Duplicate relationship IDs** → Case-insensitive entity lookup caused same ID for different case variants. Fix: Track `seen_rel_ids` set.

3. **Duplicate relationship names (Fabric API rejection)** → `sanitize_name()` truncates to 26 chars, causing `haspart_funderingsconstructie_X` variants to collide. Fix: Use numeric suffixes (`haspart_1`, `haspart_2`).

**Code Changes:**

- **NB05:** Added AdHocEntity extraction for orphan edge targets
- **NB07:** Instance-driven relationship discovery from gold layer
- **NB07:** `make_unique_name()` with numeric suffix approach
- **NB07:** `seen_rel_ids` deduplication

**Commits:** `b84b4cc`, `2fd8324`, `2382789`, `23c8225`, `89df9cb`

**Pending:** RefreshGraph job queued (long-running, ~30+ min). After completion, all 200 gold_edges should appear in Fabric Graph.

**Lessons Learned:**

1. Fabric Ontology requires **unique relationship names** (not just IDs)
2. `sanitize_name()` truncation must account for any suffix strategy
3. Instance-driven approach more robust than schema-driven for real RDF data
4. RefreshGraph is async LRO — concurrent jobs get cancelled

---

### Session: 2026-02-27 - F5.3 Data Binding Debugging 🔄

**Topics:** Fabric Ontology data binding, API structure issues, ID mismatches

**Issues Investigated:**

1. **Int32/Int64 valueType errors** → Fixed: Fabric only supports `BigInt` (not Int32/Int64/Integer/Long)
2. **RelationshipType structure errors** → Fixed: Must use `source: {entityTypeId}` not arrays
3. **Empty ontology in UI** → Fixed: Root `definition.json` must be empty `{}`, EntityType needs `namespaceType`, `visibility`, `timeseriesProperties`
4. **Entity type ID mismatch** → Fixed: Local summary files had different IDs than uploaded ontology
5. **API LRO response structure** → In progress: LRO completion returns status only, not definition

**Key Fixes to Notebook 09:**

- Changed from loading local `entity_types_*.json` files to fetching from Fabric API
- Added `get_ontology_definition_from_api()` function to retrieve uploaded definition
- After LRO completes, re-calls `getDefinition` endpoint to get actual parts
- Converts all IDs to strings for consistent lookup
- Parses `source.entityTypeId` and `target.entityTypeId` for relationships

**Fabric Ontology API Learnings:**

| Aspect | Correct Format |
|--------|----------------|
| valueType enum | `String`, `BigInt`, `Double`, `Boolean`, `DateTime`, `Object` |
| EntityType required | `namespaceType: "Custom"`, `visibility: "Visible"`, `timeseriesProperties: []` |
| RelationshipType | `source: {entityTypeId: "..."}`, `target: {entityTypeId: "..."}` |
| DataBinding | `sourceTableProperties.itemId` = Lakehouse ID, `targetPropertyId` in bindings |
| LRO pattern | Poll status URL, then re-call original endpoint for result |

**Status:** Notebook 09 updated, ready to test fetching definition from API after LRO

**Next Steps:**
1. Run notebook 09 from "Load Configuration" cell
2. Verify entity types load from API (not local files)
3. Complete data binding upload
4. Verify data appears in Fabric Graph

---

### Session: 2026-02-25 - F2.1 RDF Parser Complete ✅

**Topics:** Apache Jena JAR conflicts, shaded uber JAR solution, successful RDF parsing

**Problem: JAR Conflicts in Fabric Spark**

Multiple approaches tried to load Apache Jena dependencies:

| Approach | Result |
|----------|--------|
| Separate JARs (jena-arq, jena-core, etc.) without caffeine | Imports work, runtime `NoClassDefFoundError: caffeine` |
| Add caffeine-3.1.8.jar | Cell 2 imports fail with classloader conflict |
| Maven packages via `%%configure` | Not supported in Fabric |
| `sc.addJar()` with ABFS paths | Loads for executors but not driver classpath |

**Root Cause:** Fabric Spark includes Jackson 2.15.2 and other libraries that conflict with Jena's bundled versions.

**Solution: Shaded Uber JAR**

Created `tools/jena-shaded/` Maven project that:

1. Bundles all Jena dependencies into single JAR (~18 MB)
2. **Relocates** caffeine to `shaded.caffeine` (avoids conflict)
3. **Relocates** Google libs to `shaded.google`
4. **Excludes** Jackson (uses Fabric's version)

Build command:

```bash
cd tools/jena-shaded
./mvnw.cmd package -DskipTests
```

**Completed (F2.1 - RDF Parser Notebook):**

- ✅ Notebook `01_rdf_parser_jena.ipynb` runs fully
- ✅ Parses 4 TTL files from `examples_nen2660`
- ✅ Creates `bronze_triples` Delta table with 1,237 triples
- ✅ Schema: subject, predicate, object, object_type, datatype, lang, graph

**Test Results:**

```
+------------+------------+---------------+-----------------+
|       graph|triple_count|unique_subjects|unique_predicates|
+------------+------------+---------------+-----------------+
|  liggerbrug|         511|            126|               18|
|  ziekenhuis|         321|             99|               24|
|wegennetwerk|         252|             89|               19|
|  ijsselbrug|         153|             75|               18|
+------------+------------+---------------+-----------------+
```

**Environment Setup:**

1. Create Fabric Environment: `env_rdf_jena`
2. Upload: `tools/jena-shaded/target/jena-shaded-4.10.0.jar`
3. Publish environment
4. Attach to notebook, restart session

**Technical Learnings:**

- JDK 11 required (matches Fabric Spark runtime)
- Maven shade plugin relocates conflicting packages
- Must exclude Jackson from shaded JAR - Spark provides it
- Session restart required after environment changes
- Attach `lh_rdf_translation_dev_01` as default lakehouse (not the source lakehouse)

**Outputs:**

- `tools/jena-shaded/pom.xml` - Maven project for shaded JAR
- `tools/jena-shaded/README.md` - Build instructions and troubleshooting
- Updated `src/notebooks/01_rdf_parser_jena.ipynb` - All cells Scala, working
- Updated `src/notebooks/README.md` - Environment setup documentation

---

### Session: 2026-02-25 (Part 2) - F3.1 Schema Detector Complete ✅

**Topics:** Schema richness detection, owl:imports discovery, recommendations

**Completed (F3.1 - Schema Richness Detector):**

Created `src/notebooks/02_schema_detector.ipynb` with pure PySpark (no Jena JAR required):

- ✅ Detects schema levels 0-4 (Instance Data → SKOS → RDFS → OWL → SHACL)
- ✅ Returns confidence score (low/medium/high) based on indicator coverage
- ✅ Classifies each graph as `schema` / `instance` / `mixed`
- ✅ Detects `owl:imports` references to external ontologies
- ✅ Generates smart recommendations:
  - Suggests loading informative/normative schemas when only instance data found
  - Identifies missing owl:imports that should be loaded
  - Recommends SHACL shapes for validation when available

**Enhancement:** Added support for users who have informative ontology files - the detector now recognizes when data is instance-only and recommends loading associated schema files.

**Schema Level Detection:**

| Level | Name | Key Indicators |
|-------|------|----------------|
| 0 | Instance Data Only | Only rdf:type, no class definitions |
| 1 | SKOS Vocabulary | skos:Concept, skos:prefLabel, skos:broader |
| 2 | RDFS Schema | rdfs:Class, rdfs:subClassOf, rdfs:domain |
| 3 | OWL Ontology | owl:Class, owl:ObjectProperty, owl:DatatypeProperty |
| 4 | SHACL Shapes | sh:NodeShape, sh:PropertyShape, sh:path |

**Outputs:**

- `src/notebooks/02_schema_detector.ipynb` - Schema richness detection notebook
- `bronze_schema_analysis` Delta table - Persisted analysis results
- Updated `docs/backlog.md` - F3.1 marked complete

---

### Session: 2026-02-25 (Part 3) - F4.1 Class to Node Type Mapping Complete ✅

**Topics:** RDF → LPG translation, class mapping, node type generation

**Completed (F4.1 - Class to Node Type Mapping):**

Created `src/notebooks/03_class_to_nodetype.ipynb` with pure PySpark:

- ✅ Finds all `owl:Class` and `rdfs:Class` types from `bronze_triples`
- ✅ Extracts `rdfs:subClassOf` hierarchy (parent types)
- ✅ Gets `rdfs:label` / `skos:prefLabel` as display names (prefers English)
- ✅ Gets `rdfs:comment` / `skos:definition` for descriptions
- ✅ Generates valid node type names (PascalCase, no special chars)
- ✅ Handles blank nodes with stable IDs
- ✅ Validates for duplicate names
- ✅ Outputs to `silver_node_types` Delta table

**Translation Rules:**

| RDF Construct | LPG Equivalent |
|---------------|----------------|
| owl:Class / rdfs:Class | Node Type (label) |
| rdfs:subClassOf | Parent types array |
| rdfs:label | Display name |
| rdfs:comment | Description |

**Outputs:**

- `src/notebooks/03_class_to_nodetype.ipynb` - Class to node type mapping notebook
- `silver_node_types` Delta table - Node type definitions
- Updated `src/notebooks/README.md` - Pipeline overview
- Updated `docs/backlog.md` - F4.1 marked complete

---

### Session: 2026-02-25 (Part 4) - F4.2 Property Mapping Complete ✅

**Topics:** Property to node property / edge mapping

**Completed (F4.2 - Property Mapping):**

Created `src/notebooks/04_property_mapping.ipynb` with pure PySpark:

- ✅ Map `owl:DatatypeProperty` → node properties with XSD→Spark type mapping
- ✅ Map `owl:ObjectProperty` → edge types
- ✅ Extract `rdfs:domain` → source node type(s)
- ✅ Extract `rdfs:range` → data type (for properties) or target node types (for edges)
- ✅ Handle multi-domain and multi-range properties (collect as arrays)
- ✅ Properties without domain/range get null source_types (generic)
- ✅ Extract labels, descriptions (prefers English), inverse relationships
- ✅ Detect functional properties
- ✅ Validation: check for duplicate property names, unknown mapping types

**Translation Rules:**

| RDF Construct | LPG Equivalent |
|---------------|----------------|
| owl:DatatypeProperty | Node property |
| owl:ObjectProperty | Edge type |
| rdfs:domain | source_types array |
| rdfs:range (xsd:*) | data_type (string, integer, boolean, etc.) |
| rdfs:range (class) | target_types array |

**XSD Type Mapping:**

| XSD Type | Spark/LPG Type |
|----------|----------------|
| xsd:string | string |
| xsd:integer, xsd:int, xsd:short | integer |
| xsd:boolean | boolean |
| xsd:decimal, xsd:double | double |
| xsd:dateTime | timestamp |
| xsd:date | date |

**Outputs:**

- `src/notebooks/04_property_mapping.ipynb` - Property mapping notebook
- `silver_properties` Delta table - Property definitions with mapping info
- Updated `src/notebooks/README.md` - Pipeline overview updated
- Updated `docs/backlog.md` - F4.2 marked complete

---

### Session: 2026-02-25 (Part 5) - F4.3 Instance Translation Complete ✅

**Topics:** Instance data translation, node/edge extraction

**Completed (F4.3 - Instance Data Translation):**

Created `src/notebooks/05_instance_translator.ipynb` with pure PySpark:

- ✅ Create node records from unique subjects with `rdf:type`
- ✅ Generate stable node IDs (local name for URIs, hash for blank nodes)
- ✅ Assign labels from `rdf:type` using `silver_node_types` mapping
- ✅ Extract properties from literal triples (pivoted to property map)
- ✅ Create edges from URI→URI triples (object properties)
- ✅ Filter schema definitions to isolate instance data
- ✅ Handle multi-valued properties (collected to arrays)

**Output Tables:**

| Table | Description |
|-------|-------------|
| `silver_nodes` | id, uri, labels[], properties{}, display_name, is_blank_node, source_graph |
| `silver_edges` | id, source_id, target_id, type, predicate_uri, source_graph |

**Outputs:**

- `src/notebooks/05_instance_translator.ipynb` - Instance translation notebook
- `silver_nodes` Delta table - Node records with properties
- `silver_edges` Delta table - Edge records linking nodes
- Updated `src/notebooks/README.md` - Pipeline overview
- Updated `docs/backlog.md` - F4.3 marked complete

---

### Session: 2026-02-25 (Part 7) - F5.1 Graph Model Generator Complete ✅

**Topics:** Graph Model JSON generation for Fabric Graph API

**Completed (F5.1 - Graph Model JSON Generator):**

Created `src/notebooks/07_graph_model_generator.ipynb` with pure PySpark:

- ✅ Generate valid Graph Model JSON from silver_node_types and silver_properties
- ✅ Map RDF datatypes to Fabric Graph types (string, int, double, boolean, datetime)
- ✅ Sanitize names for Graph API compatibility (reserved words, special chars)
- ✅ Validate JSON structure before saving
- ✅ Save timestamped + latest versions to Files/graph_models/

**Output JSON Structure:**
```json
{
  "name": "RdfTranslatedGraph",
  "version": "1.0",
  "nodes": [{"name": "NodeType", "properties": [{"name": "uri", "type": "string"}]}],
  "edges": [{"name": "relationType", "source": "NodeA", "target": "NodeB", "properties": []}]
}
```

**Outputs:**

- `src/notebooks/07_graph_model_generator.ipynb` - Graph model JSON generator
- `Files/graph_models/graph_model_*_latest.json` - Latest graph model
- Updated `docs/backlog.md` - F5.1 marked complete

---

### Session: 2026-02-25 (Part 6) - F4.4 Delta Table Writer Complete ✅

**Topics:** Gold layer transformation, final Delta tables

**Completed (F4.4 - Delta Table Writer):

Created `src/notebooks/06_delta_writer.ipynb` with pure PySpark:

- ✅ Transform silver nodes/edges to simplified gold format
- ✅ Write `gold_nodes` Delta table (id, labels, properties)
- ✅ Write `gold_edges` Delta table (source_id, target_id, type, properties)
- ✅ Support overwrite and append modes (configurable)
- ✅ Optional partitioning by primary label
- ✅ Validation checks for edge references and null IDs

**Gold Table Schemas:**

| Table | Columns |
|-------|--------|
| `gold_nodes` | id, labels[], properties{} |
| `gold_edges` | source_id, target_id, type, properties{} |

**Outputs:**

- `src/notebooks/06_delta_writer.ipynb` - Delta table writer notebook
- `gold_nodes` Delta table - Final nodes for graph import
- `gold_edges` Delta table - Final edges for graph import
- Updated `src/notebooks/README.md` - Pipeline overview
- Updated `docs/backlog.md` - F4.4 marked complete

---

### Session: 2026-02-26 - F5.1 Ontology Definition Generator Complete ✅

**Topics:** Fabric Ontology definition generation, base64 encoding, entity/relationship types

**Completed (F5.1 - Ontology Definition Generator):**

Created `src/notebooks/07_ontology_definition_generator.ipynb` with pure PySpark:

- ✅ Generate entity type definitions from `silver_node_types` table
- ✅ Generate property definitions with Fabric Ontology types (String, BigInt, Double, Boolean, DateTime)
- ✅ Generate relationship type definitions from `silver_properties` (object properties)
- ✅ Map RDF/XSD datatypes to Fabric Ontology types
- ✅ Validate entity/property names (1-26 chars, alphanumeric + hyphens/underscores)
- ✅ Output base64-encoded definition parts ready for API upload
- ✅ Generate unique deterministic IDs from URIs using MD5 hashing
- ✅ Save human-readable summaries for debugging

**Definition Structure:**

```
.platform                                  → Metadata (type, displayName)
definition.json                            → Root definition (namespace, entityTypeIds, relationshipTypeIds)
EntityTypes/{id}/definition.json           → Entity type (name, properties, entityIdParts)
RelationshipTypes/{id}/definition.json     → Relationship type (name, source, target)
```

**Key Design Decisions:**

- Use `uri` property as entity key (`entityIdParts`) for all entity types
- Generate deterministic IDs from URIs for reproducibility
- Namespace: `rdftranslation` for all generated types
- Datatype properties become entity properties
- Object properties become relationship types

**Outputs:**

- `src/notebooks/07_ontology_definition_generator.ipynb` - Ontology definition generator
- `Files/ontology_definitions/ontology_definition_{timestamp}.json` - API-ready definition
- `Files/ontology_definitions/entity_types_{timestamp}.json` - Human-readable entity summary
- `Files/ontology_definitions/relationship_types_{timestamp}.json` - Human-readable relationship summary
- Updated `docs/backlog.md` - F5.1 marked complete

**Next P0 Task:** None - all P0 items complete! Ready for P1 work (F5.2 REST API Client, F5.3 Data Binding).

---

### Session: 2026-02-26 (Part 2) - F5.2 & F5.3 Complete ✅

**Topics:** Fabric Ontology REST API client, Lakehouse data binding

**Completed (F5.2 - Fabric Ontology REST API Client):**

Created `src/notebooks/08_ontology_api_client.ipynb`:

- ✅ Authenticate using Entra ID token via `mssparkutils.credentials.getToken()`
- ✅ Create new Ontology item in workspace
- ✅ List existing ontologies
- ✅ Get Ontology definition
- ✅ Update Ontology definition (upload entity types, properties, relationships)
- ✅ Handle long-running operations (LRO) with polling
- ✅ Retry logic for transient failures (429, 5xx)
- ✅ Save ontology config for downstream notebooks

**Completed (F5.3 - Lakehouse Data Binding):**

Created `src/notebooks/09_data_binding.ipynb`:

- ✅ Generate static data binding JSON for entity types
- ✅ Map gold_nodes columns to entity type properties
- ✅ Generate relationship binding for gold_edges
- ✅ Set entity type key (uri column as unique identifier)
- ✅ Upload bindings via `POST /ontologies/{id}/updateDefinition`
- ✅ Save binding configuration for reference

**Key Design Decisions:**

- Entity key property: `uri` column from gold_nodes
- Data binding type: NonTimeSeries (static Lakehouse binding)
- Relationship binding: source_id/target_id columns from gold_edges
- Entity filter: `array_contains(labels, '{entity_type_name}')`

**Outputs:**

- `src/notebooks/08_ontology_api_client.ipynb` - REST API client
- `src/notebooks/09_data_binding.ipynb` - Data binding generator
- Updated `docs/backlog.md` - F5.2, F5.3 marked complete
- Updated `src/notebooks/README.md` - Added notebooks 08 and 09

**Next P1 Task:** F6.1 SHACL Shape Parser (validation before data load)

---

### Session: 2026-02-24 (Part 3) - Implementation Start
**Topics:** React app scaffold, Lakehouse setup, RDF parser notebook

**Completed (F7.1 - React App Scaffold):**
- Created full React + Electron + Fluent UI v9 application scaffold
- 20+ files in `src/app/` including:
  - Vite 5.1 + React 18 + TypeScript configuration
  - MSAL.js authentication setup
  - Zustand state management with persistence
  - Fluent UI v9 theming and layout components
  - Electron main process with menu bar
  - Vitest test setup with sample tests
- Key pages: LoginPage, HomePage (projects), ProjectPage (12 B-decisions), SettingsPage

**Completed (F1.2 - Lakehouse Setup):**
- Created lakehouse `lh_rdf_translation_dev_01` (manual - MCP API limitation)
- Created folder structure: `Files/raw/`, `Files/bronze/`, `Files/silver/`, `Files/gold/`, `Files/config/`
- Workaround: Upload placeholder files to create directories (directory_create API not working)

**Completed (F1.3 - Test Data Shortcuts):**
- Created shortcuts in Files section (not Tables) to `lh_nen2660data_dev_01`:
  - `examples_nen2660/` - 4 TTL test files (ijsselbrug, liggerbrug, wegennetwerk, ziekenhuis)
  - `informative_nen2660/` - Informative ontology TTLs
  - `normative_nen2660/` - Normative ontology TTLs

**In Progress (F2.1 - RDF Parser Notebook):**
- Initial Python/rdflib version worked but replaced per design preference for Apache Jena
- Created Scala notebook `01_rdf_parser_jena.ipynb`
- **Fabric Environment Setup:**
  - Created `env_rdf_jena` environment with custom JAR uploads
  - JARs needed: jena-arq-4.10.0, jena-core-4.10.0, jena-base-4.10.0, jena-iri-4.10.0, caffeine-3.1.8
  - JARs also stored in `Files/apache_jena_jars/` as backup
- Discovery: `%%configure` and `sc.addJar()` don't work for driver classpath in Fabric
- Solution: Custom Environment with direct JAR uploads adds to classpath
- Issue to debug: Session state sometimes doesn't pick up JARs until restart

**Technical Learnings:**
- Fabric MCP cannot create Lakehouses programmatically (400 errors)
- Fabric MCP cannot create directories directly - use file upload workaround
- Shortcuts must be created at Files level, not Lakehouse level
- Maven libraries not available in Fabric Environment - must upload JARs directly
- ABFS paths required for some operations: `abfss://{workspace}@onelake.dfs.fabric.microsoft.com/{lakehouse}.Lakehouse/Files/`

**Outputs:**
- `src/app/` - Complete React app scaffold (20+ files)
- `src/notebooks/01_rdf_parser_jena.ipynb` - Scala/Jena RDF parser
- `src/notebooks/README.md` - Notebook pipeline documentation
- Fabric Environment `env_rdf_jena` with Jena dependencies

### Session: 2026-02-24 (continued) - Research Spike Completion
**Topics:** Fabric Graph and Ontology API research, RDF support investigation
**Critical Finding:** Fabric Graph does NOT support RDF natively - uses Labeled Property Graph (LPG)

**Research Results (S1-S6):**
- S1: Graph Model REST API documented with JSON definition format
- S2: OWL NOT supported - must translate owl:Class → Node Types, owl:ObjectProperty → Edges
- S3: SHACL NOT supported - must validate with pySHACL before loading
- S4: Schema evolution NOT supported - requires new Graph Model version
- S5: Import timing estimated (tables for performance data)
- S6: Fabric Graph still in public preview (no GA date announced)

**Architecture Impact:**
- Must build RDF → LPG translation layer
- Pipeline: Parse RDF → Translate to LPG → Write Delta tables → Generate Graph Model JSON → Create via REST API
- No native OWL/RDFS reasoning in Fabric

**Outputs:**
- Created [research-spike-results.md](research-spike-results.md) with full findings
- Added Decision #13: RDF to LPG Translation Layer
- Updated project-context.md with completed research status

### Session: 2026-02-24 (continued) - Customer Workspace Choice
**Topics:** Fabric workspace strategy for external users
**Decisions made:**
- App does NOT auto-create workspaces (avoids permission escalation)
- Customer chooses: new dedicated workspace OR existing workspace
- Customer configures workspace URL on first app run
- Works with customer's existing Fabric governance model

**Outputs:**
- Added Decision #12 to project-context.md
- Updated requirements.md Section 3.4 with workspace strategy
- Updated README.md installation instructions
- Updated src/fabric/README.md with installation details

### Session: 2026-02-24 (continued) - Distribution Model Decision
**Topics:** App packaging, external tenant distribution, dual deployment
**Decisions made:**
- Ship both Web App (Azure SWA) and Desktop App (Electron) from **same React codebase**
- Target audience: External organizations (different Entra tenants)
- Desktop app simplifies installation (no Azure deployment required)
- Web app good for teams and shared access
- Graph visualization via React Flow for interactive preview
- Auth: SSO (web) / device code (desktop) - both work cross-tenant
- Updated project structure: `src/fabric/` for notebooks, `src/app/` for React/Electron

**Outputs:**
- Updated architecture.md with dual deployment diagram
- Updated requirements.md Section 3.4 (Distribution & Deployment)
- Added Decision #11 to project-context.md

### Session: 2026-02-24 (continued) - Requirements Finalization
**Topics:** Performance requirements, compliance, CI/CD strategy, research spike planning
**Decisions made:**
- Performance targets: <30s schema detection, <2min small, <15min medium, <60min large datasets
- Compliance: Inherit from Fabric tenant, audit via Activity Log, PII is user responsibility
- CI/CD: GitHub Actions for linting/tests, Fabric deployment pipelines for environment promotion
- Multi-environment: Dev → Test → Prod workspaces with standard naming
- Created research spike task list for Fabric Ontology API exploration
- Phase status updated: Requirements Complete → Implementation Ready

**Outputs:**
- Updated requirements.md Section 3.1 (Performance) with processing time targets
- Updated requirements.md Section 3.2 (Compliance) with defaults
- Updated requirements.md Section 4.7 (Development Environment) with CI/CD strategy
- Added Next Steps with phased task lists (Infrastructure, Research Spike, Implementation)
- Created `.github/workflows/` with GitHub Actions CI configuration

### Session: 2026-02-24 (continued) - Adaptive Guidance Sequencing
**Topics:** Smart guidance flow, scenario-specific UX, decision prioritization
**Decisions made:**
- Add UX11-13 requirements for adaptive guidance
- Dashboard adapts based on detected input scenario (A-F)
- Priority queue: Foundation (B1→B6→B8) → Data-driven → Semantic → Presentation
- "Recommended Next" badge on highest-priority uncompleted decision
- Irrelevant decisions greyed out (e.g., B4 if no named graphs)
- User freedom preserved - non-linear navigation still allowed
- Confirmed: NEN 2660 is test data only; app is fully generic

### Session: 2026-02-24 (continued) - Schema Richness Levels
**Topics:** Graduated schema detection, test data structure, user scenarios
**Decisions made:**
- Replace binary Schema-First/Instance-Only with 5 levels (0-4)
- Level 0: Instance-only, Level 1: SKOS, Level 2: RDFS, Level 3: OWL, Level 4: SHACL  
- Document actual NEN 2660-2 test files (normative/informative/examples)
- Define 6 user input scenarios (A-F) for different file combinations
- Format auto-detection from extension and content sniffing
- Progressive schema detection: check highest level first

### Session: 2026-02-24 - Schema Availability Modes
**Topics:** RDFS value proposition, schema-guided vs instance-only workflows
**Decisions made:**
- Schema-First Mode: When RDFS available, 5 B-decisions auto-resolve
- Instance-Only Mode: All 12 decisions require user input
- Schema detection as first step in analysis flow
- Dashboard shows schema mode prominently with appropriate guidance
- Auto-resolved decisions can be overridden if needed

**Outputs:**
- Added Section 2.2 "Schema Availability Modes" to requirements.md
- Updated B-category decisions with schema impact indicators
- Added schema detection flow diagram to architecture.md
- Updated dashboard mockups for both modes
- Added `nb_schema_detector` notebook to architecture
- Updated project config schema with schemaMode object

### Session: 2026-02-23 (Part 2) - Architecture & UX
**Topics:** UX requirements, architecture design
**Decisions made:**
- UI Technology: Fabric App (React) - full custom UI for decision-making
- Decision Flow: Dashboard overview (all 12 decisions visible at once, any order)
- Preview: Essential - must see sample nodes/edges before final import
- Project Model: Multi-project - each RDF source = saved project with decisions
- Execution: Both app-triggered and manual pipeline run supported
- User Personas confirmed: KG Specialist + Business Analyst collaborate; Data Engineer implements

**Outputs:**
- Rewrote `architecture.md` with full component design
- Added UX requirements section to `requirements.md`

### Session: 2026-02-23 (Part 1) - Workspace & Data Source
**Topics:** Fabric workspace strategy, source data location
**Decisions made:**
- New dedicated workspace: `ws-rdf_translation-dev-01`
- Source data in: `ws-ont_nen2660-dev-01` / `lh_nen2660data_dev_01`
- Data folders: `normative_nen2660/`, `informative_nen2660/`, `examples_nen2660/`

### Previous Sessions - Decision Framework & Requirements
**Topics:** Problem definition, translation categories, Fabric requirements
**Decisions made:**
- 3-category decision framework (A/B/C)
- Category A: 7 auto-resolvable items
- Category B: 12 human decisions required
- Category C: 8 fundamental limitations
- Fabric Graph requires managed Delta tables
- Schema evolution not supported

---

## Next Steps

> **Detailed Backlog:** See [backlog.md](backlog.md) for comprehensive feature list with acceptance criteria and tests.

### Phase 1: Infrastructure Setup
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Create Fabric workspace `ws-rdf_translation-dev-01` | ✅ | Decision #14 |
| 1.2 | Create lakehouse `lh_rdf_translation_dev_01` | ⬜ | Intermediate storage |
| 1.3 | Create shortcut to test data in `ws-ont_nen2660-dev-01` | ⬜ | Access NEN 2660 files |
| 1.4 | Validate NEN 2660 test files exist and structure | ⬜ | Confirm expected folders |
| 1.5 | Enable Git integration for workspace | ✅ | `/fabric` → `main` branch |

### Phase 2: Research Spike - Fabric Ontology API ✅ COMPLETED

> **Purpose:** Resolve blocking unknowns about Fabric Ontology and Graph capabilities before implementation.

| # | Task | Goal | Status |
|---|------|------|--------|
| S1 | Explore Fabric Ontology API format | Determine JSON structure for ontology import | ✅ Done |
| S2 | Test OWL subset support | Which OWL constructs work? | ✅ Done - NOT SUPPORTED |
| S3 | Test SHACL support | Are `NodeShape`/`PropertyShape` supported? | ✅ Done - NOT SUPPORTED |
| S4 | Schema evolution experiment | What happens when ontology changes? | ✅ Done - NOT SUPPORTED |
| S5 | Fabric Graph import timing | Benchmark import for various sizes | ✅ Estimated |
| S6 | Fabric Graph GA timeline check | Review MS docs/roadmap | ✅ Still Preview |

#### Critical Finding (Decision #13)

**Fabric Graph does NOT support RDF directly.** It uses the **Labeled Property Graph (LPG)** model.

**Implications:**
- We must build an **RDF → LPG translation layer**
- OWL classes → Node Types (labels)
- OWL datatype properties → Node properties
- OWL object properties → Edge types
- SHACL validation must happen **before** loading into Fabric

**Full details:** See [research-spike-results.md](research-spike-results.md)

### Phase 3: Implementation

> **Full implementation backlog:** See [backlog.md](backlog.md) for 27 features with detailed acceptance criteria.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Prototype `nb_schema_detector` notebook | ⬜ | See F3.1 in backlog |
| 3.2 | Build RDF parser utilities | ⬜ | See F2.1-F2.3 in backlog |
| 3.3 | Create basic Fabric App shell | ⬜ | See F7.1 in backlog |
| 3.4 | Implement project config storage | ⬜ | See F7.4 in backlog |
| 3.5 | Build first translation pipeline | ⬜ | See F9.1 in backlog |

---

## Fabric Workloads Reference

Potential workloads for this RDF translation project:

| Workload | Use Case in This Project |
|----------|-------------------------|
| **Lakehouse** | Store raw data (Bronze) and transformed data (Silver/Gold) |
| **Notebooks** | RDF translation logic, ontology mapping, validation |
| **Pipelines** | Orchestrate ingestion and transformation workflows |
| **Warehouse** | Optional - if SQL-based analytics needed |
| **Reports** | Visualize translation metrics, data quality |

---

## Key Commands

```bash
# Navigate to project
cd "C:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation"

# Check git status
git status

# Commit changes
git add .
git commit -m "Your commit message"

# Open in VS Code
code .
```

---

## Questions to Answer (Requirements Phase)

1. What data sources need RDF translation?
2. What RDF format(s) are required? (Turtle, N-Triples, JSON-LD, RDF/XML?)
3. What ontologies/vocabularies will be used?
4. What are the transformation rules?
5. Who/what consumes the RDF output?
6. What are the volume and performance requirements?

---

## Resources

- [Microsoft Fabric Documentation](https://learn.microsoft.com/en-us/fabric/)
- [OneLake Overview](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)
- [Fabric REST API](https://learn.microsoft.com/en-us/rest/api/fabric/)

---

## Session Log: 2026-03-10

### Summary
Fixed critical bugs in NB07 and NB09 that prevented proper edge and property mapping in the Fabric Graph.

### Issues Found and Fixed

#### Issue 1: Edge Filter Mismatch (Critical)
**Discovery:** GQL query `MATCH ()-[e]->() RETURN count(e)` returned only 90 edges, expected 193 from `gold_edges`.

**Root Cause:** NB07 creates suffixed relationship names for uniqueness (e.g., `haspart_1`, `haspart_2`) when multiple relationship types have the same base name. NB09 used these suffixed names in the GraphModel edge table filter:
```python
"filter": {"operator": "Equal", "columnName": "type", "value": "haspart_1"}
```
But `gold_edges.type` column contains the original unsuffixed names (`haspart`).

**Fix Applied (NB09):** Strip numeric suffix to get original edge type:
```python
import re as _re_edge
filter_value = _re_edge.sub(r'_\d+$', '', rel_name)
```

**Result:** 588 edges now materialized (up from 90). Multiple relationship types correctly map to the same base edge data.

#### Issue 2: Property Mapping Skip
**Discovery:** GQL query `RETURN n.uri` returned "Property 'uri' not found".

**Root Cause:** NB09 had logic that skipped the `uri` property with comment "'id' column already covers the URI". But `id` is an internal hash identifier, while `uri` is the actual RDF IRI users need to query.

**Fix Applied (NB09):** Removed the skip logic in two places:
1. Node type property definitions
2. Property mappings

#### Issue 3: Redundant RefreshGraph Trigger
**Discovery:** RefreshGraph jobs took ~40 minutes each, and two were being triggered.

**Root Cause:** `updateDefinition` API call auto-triggers RefreshGraph (undocumented behavior). Step 4's explicit trigger was redundant.

**Confirmed via:** Fabric Monitor showing two jobs - one starting immediately after Step 3, another after Step 4's trigger.

**Fix Applied (NB09):** Step 4 now only monitors for completion, never triggers explicitly.

### Fabric GQL Limitations Documented

| Limitation | Workaround |
|------------|------------|
| No `labels()` function | Query specific node types |
| No `type()` for edges | Query specific edge types |
| No `STARTS WITH` | Use full string match |
| Requires `AS` aliases | Always alias RETURN values |
| GROUP BY strict | Include all non-aggregated columns |

### Final Metrics (After Fixes)
| Metric | Before | After |
|--------|--------|-------|
| Nodes in Graph | 159 | 159 |
| Edges in Graph | 90 | **588** |
| Property access | ❌ Error | ✅ Pending re-run |

### Files Modified
- `src/notebooks/07_ontology_definition_generator.ipynb` - Added `sourceFilterValue` to relationship types (partial, not used)
- `src/notebooks/09_data_binding.ipynb` - Edge filter fix, property mapping fix, monitor-only Step 4

### Next Steps
1. Re-run NB09 to apply property mapping fix
2. Verify `n.uri` queries work
3. Continue with Week 1 UI tasks

---

## Session: 2026-03-12

### Primary Goals
1. Schema level selector showing all 5 levels (was showing 3)
2. Fix browser dependency for long-running pipelines

### UI Improvements: Schema Level Display

**Issue:** Decision dashboard showed 3 schema levels (0-2) instead of all 5 (0-4).

**Fix Applied (ProjectPage.tsx):**
- Show all 5 filter buttons: Level 0-4
- Clear labels: RDF, SKOS, RDFS, OWL, SHACL
- Format: "Level 0 — RDF (12)"

### Critical Issue: Browser Dependency

**Problem Discovered:** Pipeline stopped at NB06 when browser tracking was interrupted. The old approach ran 9 notebooks sequentially from the browser—if the tab closes or refreshes during a long-running job, the pipeline breaks.

**Impact:** Pipelines can run 30-60+ minutes. Browser must stay open the entire time—unacceptable for production use.

### Solution: Server-Side Orchestrator

Implemented **Option 3: Orchestrator + Progress File Polling**:

| Component | Description |
|-----------|-------------|
| `NB00: pipeline_orchestrator` | Runs NB01-NB09 via `mssparkutils.notebook.run()` |
| `pipeline_progress.json` | Written to OneLake after each step |
| App polling | Reads progress file every 10 seconds |
| Resilience | Browser can close, pipeline continues |

**Files Created/Modified:**

1. **`src/notebooks/00_pipeline_orchestrator.ipynb`** (NEW)
   - Reads `pipeline_run.json` for config
   - Runs all notebooks sequentially with timeouts
   - Writes progress to `Files/config/pipeline_progress.json`
   - Records step timing, status, and errors

2. **`src/app/src/services/fabricService.ts`**
   - Added `PipelineProgress` interface
   - Added `readOneLakeFile()` - generic OneLake file read
   - Added `readPipelineProgress()` - reads progress JSON
   - Added `runOrchestrator()` - triggers NB00

3. **`src/app/src/components/TranslationPanel.tsx`**
   - Triggers orchestrator instead of 9 individual notebooks
   - Polls progress file every 10 seconds via `useEffect`
   - "Check Status" button to resume polling after browser reopen
   - "Server-Side Execution" info message during run

### Progress File Format

```json
{
  "current": "NB03",
  "completed": ["NB01", "NB02"],
  "status": "running",
  "error": null,
  "step_times": {
    "NB01": {"start": "...", "end": "...", "duration_sec": 45},
    "NB02": {"start": "...", "end": "...", "duration_sec": 12}
  },
  "total_steps": 9,
  "updated_at": "2026-03-12T12:00:00Z"
}
```

### Deployment Note

**Action Required:** Upload `src/notebooks/00_pipeline_orchestrator.ipynb` to Fabric workspace before testing new orchestrator flow.
