# RDF2Fabric

A **proof of concept** exploring what it takes to import RDF (Semantic Web) data into Microsoft Fabric Real-Time Intelligence — specifically Fabric Ontology and Fabric Graph.

## Status (Mar 21, 2026)

✅ **Proof of Concept Complete** — Full pipeline working with 11/12 B-decisions implemented

| Component | Status |
|-----------|--------|
| RDF Parser (Jena) | ✅ Turtle, TriG, JSON-LD, RDF/XML, N-Triples, N-Quads |
| Schema Detection | ✅ 5 levels (Instance-only → SHACL) |
| Translation Pipeline | ✅ NB00-NB09 orchestrated execution |
| Decision Enforcement | ✅ 11/12 decisions read from config + enforced |
| Ontology API | ✅ Entity types, relationships, data bindings |
| Graph Materialization | ✅ 74 entities, 48 relationships, 372 edges |
| External Ontology Fetch | ✅ F2.4 complete — HTTP fetch with content negotiation |
| GQL Queries | ✅ Tested — adjacency patterns working |
| React App | ✅ Auth, workspace config, file browser, decision dashboard |
| Pipeline Execution | ✅ Server-side orchestrator with progress tracking |

## What This PoC Explores

RDF and Fabric Graph use fundamentally different graph paradigms that cannot be mapped 1:1. This PoC investigates the **translation challenges**, the **12 modeling decisions** involved, and the current capabilities and limitations of Fabric's Ontology and Graph APIs.

- **RDF → LPG translation**: Parsing RDF, discovering schema, mapping classes to entity types, properties to attributes, and object properties to relationships
- **Fabric Ontology API integration**: Creating ontology definitions, uploading data bindings, handling LRO patterns
- **Fabric Graph materialization**: Building GraphModel definitions, triggering RefreshGraph, understanding the end-to-end pipeline
- **Decision enforcement**: App captures user decisions, notebooks read and act on them
- **NEN 2660-2 as test data**: Dutch built environment standard used to exercise the full translation pipeline

## Quick Start

### Prerequisites

1. **Fabric workspace** with capacity (F64 or higher recommended)
2. **Lakehouse** in the workspace
3. Git integration enabled on the workspace

### Setup

1. **Fork this repo** to your GitHub account
2. **Connect your Fabric workspace** to the fork:
   - Workspace Settings → Git integration → Connect
   - Sync folder: `/src/fabric/`
3. **Create shortcuts** to test data (NEN 2660-2):
   ```
   Files/normative_nen2660  → shortcut to NEN 2660 normative files
   Files/examples_nen2660   → shortcut to example TTL files
   ```
4. **Publish environment** with Jena JAR:
   - Upload `tools/jena-shaded/target/jena-shaded-4.10.0.jar`
   - Create environment `env_rdf_jena`
5. **Run the pipeline** via NB00 (orchestrator) or run NB01-NB09 individually

### Web App (Optional)

The React app provides a UI for decision-making and pipeline execution:

```bash
cd src/app
npm install
npm run dev
```

Configure workspace URL in Settings, then use the Decision Dashboard.

## Project Structure

```
fabric_rdf_translation/
├── docs/                     # Documentation
│   ├── project-status.md     # Current state & sprint progress
│   ├── architecture.md       # System design & decisions
│   ├── backlog.md            # Feature backlog
│   └── data-sources.md       # Test data (NEN 2660-2)
│
├── src/
│   ├── notebooks/            # Spark notebooks (local copies)
│   │   ├── 00_pipeline_orchestrator.ipynb
│   │   ├── 01_rdf_parser_jena.ipynb
│   │   └── ... (NB02-NB13)
│   ├── fabric/               # Fabric items (synced via Git)
│   │   └── notebooks/
│   └── app/                  # React frontend
│
├── tools/
│   └── jena-shaded/          # Apache Jena JAR for Spark
│
└── infra/                    # Azure deployment (bicep)
```

## Notebook Pipeline

| Notebook | Purpose |
|----------|---------|
| NB00 | **Orchestrator** — runs NB01-NB09, writes progress file |
| NB01 | Parse RDF → `bronze_triples` |
| NB02 | Detect schema level (0-4) |
| NB03 | Extract classes → `silver_node_types` |
| NB04 | Extract properties → `silver_edge_types`, `silver_datatype_props` |
| NB05 | Transform instances → `silver_nodes`, `silver_edges` |
| NB06 | Write gold Delta tables |
| NB07 | Generate Ontology definition JSON |
| NB08 | Upload to Ontology API |
| NB09 | Create data bindings, trigger RefreshGraph |
| NB10-11 | SHACL parsing and validation |
| NB12 | External ontology HTTP fetcher |
| NB13 | Ontology enrichment (labels, hierarchy) |

## Key Findings

| Finding | Implication |
|---------|-------------|
| Fabric Graph uses GQL (ISO), not Gremlin | Query syntax differs from Neo4j/Neptune |
| Schema ≠ Instance predicates | `owl:hasFunctionalPart` vs actual `hasPart` |
| Type-specific relationships | `hasPart` becomes `haspart_1`, `haspart_2` per node type pair |
| RefreshGraph is async + expensive | 30+ minute jobs, must poll for completion |
| ConcurrentOperation cancels jobs | Only one RefreshGraph at a time |
| `count` is reserved in GQL | Use `AS cnt` or `AS total` instead |
| Connection hub pattern | `isConnectedTo` uses intermediate Connection nodes |

## Documentation

- [Project Status](docs/project-status.md) — Current state and sprint progress
- [Architecture](docs/architecture.md) — System design and decisions
- [Backlog](docs/backlog.md) — Feature backlog and implementation status
- [Data Sources](docs/data-sources.md) — Test data documentation
- [Requirements](docs/requirements.md) — Business & technical requirements
