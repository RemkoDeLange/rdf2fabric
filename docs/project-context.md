# Project Context - Fabric RDF Translation

## Session Summary
**Date:** 2026-02-24  
**Project:** fabric_rdf_translation  
**Location:** `C:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation`

---

## RDF Implementation Decisions Log

Tracking specific RDF-related implementation decisions encountered during development. These are more granular than the 12 B-decisions and inform future UI/configuration options.

| ID | Decision | Options | Current Choice | Rationale | B-Decision | Status |
|----|----------|---------|----------------|-----------|------------|--------|
| R1 | **Language preference** | Any ISO 639-1 code | `en` (English) | Fabric Ontology accepts single value per entity; RDF supports multi-language | B10 | ✅ Configurable |
| R2 | **External ontology dereferencing** | Dereference URIs / Use local only | Local only | External URIs may be slow/unavailable; can cache later | - | ⬜ Phase 2 (F2.4) |
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
- [ ] F5.4 Graph Materialization - verify RefreshGraph populates Graph

**Pending (Next Session):**
- [ ] Re-run NB07→NB08→NB09 in Fabric with fixed ID generation
- [ ] Verify Graph nodes/edges visible in Fabric portal

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
- [ ] Delete existing ontology in Fabric (old 13-digit IDs)
- [ ] Re-run NB07→NB08→NB09 with new ID generation
- [ ] Verify Graph nodes/edges visible in Fabric portal

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
