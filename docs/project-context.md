# Project Context - Fabric RDF Translation

## Session Summary
**Date:** 2026-02-23  
**Project:** fabric_rdf_translation  
**Location:** `C:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation`

---

## Project Background

This project is being developed to build a **generic RDF translation application** for Microsoft Fabric. The application will translate **any** RDF (Semantic Web) data to Fabric Graph, regardless of domain or ontology. NEN 2660-2 is used as test data during development, but the tool is designed to work with DBpedia, schema.org, FIBO, or any custom ontology.

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
  - `Files/normative/` - Normative NEN 2660 ontology (SKOS, RDFS, OWL, SHACL)
  - `Files/informative/` - Informative NEN 2660 content (format variants)
  - `Files/examples/` - Example RDF data (IJsselbrug, Liggerbrug, etc.)

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
- [ ] Create development Fabric workspace (`ws-rdf_translation-dev-01`)
- [ ] Scaffold React app with Electron support
- [ ] Prototype notebooks (starting with RDF → Delta tables)

---

## Key Decisions Summary

See **Decisions Made** section above for numbered canonical decisions (1-12).
See **Session Archive** section below for dated session logs.

---

## Session Archive

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

### Phase 1: Infrastructure Setup
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Create Fabric workspace `ws-rdf_translation-dev-01` | ⬜ | Development environment |
| 1.2 | Create lakehouse `lh_rdf_translation_dev_01` | ⬜ | Intermediate storage |
| 1.3 | Create shortcut to test data in `ws-ont_nen2660-dev-01` | ⬜ | Access NEN 2660 files |
| 1.4 | Validate NEN 2660 test files exist and structure | ⬜ | Confirm expected folders |
| 1.5 | Enable Git integration for workspace | ⬜ | Connect to this repo |

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
| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Prototype `nb_schema_detector` notebook | ⬜ | Test 5-level detection logic |
| 3.2 | Build RDF parser utilities | ⬜ | rdflib wrapper for Spark |
| 3.3 | Create basic Fabric App shell | ⬜ | React + Fluent UI scaffold |
| 3.4 | Implement project config storage | ⬜ | JSON in lakehouse |
| 3.5 | Build first translation pipeline | ⬜ | End-to-end proof of concept |

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
