# Fabric Backend

This folder is a **placeholder for Fabric Git integration**. The actual notebooks are maintained in [`../notebooks/`](../notebooks/).

## Current Structure

```
fabric/
├── notebooks/            # Placeholder (.gitkeep) — for Fabric Git sync
├── pipelines/            # Placeholder (.gitkeep) — for Fabric Git sync
└── README.md             # This file
```

## Where Are the Notebooks?

All notebooks are in **[`src/notebooks/`](../notebooks/)**, which is the source of truth. See the [notebooks README](../notebooks/README.md) for the full pipeline documentation.

### Pipeline Overview

| # | Notebook | Description |
|---|----------|-------------|
| 00 | `00_pipeline_orchestrator` | Server-side orchestrator — runs NB01-NB09 |
| 01 | `01_rdf_parser_jena` | Parse RDF files using Apache Jena |
| 02 | `02_schema_detector` | Detect schema richness level (0-4) |
| 03 | `03_class_to_nodetype` | Map classes to entity types |
| 04 | `04_property_mapping` | Map properties to attributes/edges |
| 05 | `05_instance_translator` | Translate instances to nodes/edges |
| 06 | `06_delta_writer` | Write gold tables for graph import |
| 07 | `07_ontology_definition_generator` | Generate Fabric Ontology definition |
| 08 | `08_ontology_api_client` | Upload ontology via REST API |
| 09 | `09_data_binding` | Bind tables for Graph materialization |

## Fabric Workspace Setup

> **You choose the workspace.** The app/notebooks do NOT auto-create workspaces.

### Option 1: Manual Import

1. Create a Fabric workspace with capacity (F64+ recommended)
2. Create a Lakehouse in the workspace
3. Import notebooks from `src/notebooks/` manually
4. Create environment `env_rdf_jena` with the Jena shaded JAR

### Option 2: Git Integration (Planned)

When Fabric Git sync is configured:

1. Connect workspace to this repo
2. Set sync folder to `/src/fabric/`
3. Copy notebooks from `src/notebooks/` to `src/fabric/notebooks/` for sync

> **Note:** This folder currently contains only `.gitkeep` files. For active development, notebooks are maintained in `src/notebooks/` and imported to Fabric manually.

## Dependencies

**Apache Jena (required for RDF parsing):**

Build the shaded JAR:
```bash
cd tools/jena-shaded
./mvnw.cmd package -DskipTests   # Windows
./mvnw package -DskipTests       # Linux/Mac
```

Upload `target/jena-shaded-4.10.0.jar` to a Fabric Environment named `env_rdf_jena`.

## API

The web/desktop app triggers pipeline execution via the Fabric REST API:

```
POST /v1/workspaces/{workspaceId}/items/{notebookId}/jobs/instances?jobType=RunNotebook
```

The orchestrator notebook (NB00) writes progress to `Files/config/pipeline_progress.json`, which the app polls for status updates.
