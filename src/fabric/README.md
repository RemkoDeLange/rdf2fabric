# Fabric Backend

This folder contains Microsoft Fabric items that power the RDF translation backend.

## Folder Structure

```
fabric/
├── notebooks/            # Spark notebooks
│   ├── nb_schema_analyzer.py     # Detect schema richness level
│   ├── nb_preview_generator.py   # Generate sample preview data
│   ├── nb_translator.py          # Main RDF→Delta translation
│   └── nb_graph_loader.py        # Load to Fabric Graph
│
└── pipelines/            # Data pipelines
    ├── pl_full_translation.json  # End-to-end pipeline
    └── pl_preview_only.json      # Preview generation only
```

## Installation

> **You choose the workspace.** The app/notebooks do NOT auto-create workspaces.

1. **Choose a workspace:** Create a new workspace or use an existing one
2. **Connect to GitHub:** Go to workspace Settings → Git integration → connect to your fork of this repo
3. **Automatic sync:** Fabric imports notebooks and pipelines from this folder
4. **Lakehouse:** Created automatically when notebooks first run

### What Gets Installed

| Item | Type | Auto-Created |
|------|------|---------------|
| `nb_schema_analyzer` | Notebook | Via Git sync |
| `nb_preview_generator` | Notebook | Via Git sync |
| `nb_translator` | Notebook | Via Git sync |
| `nb_graph_loader` | Notebook | Via Git sync |
| `pl_full_translation` | Pipeline | Via Git sync |
| `pl_preview_only` | Pipeline | Via Git sync |
| `lh_rdf_translation` | Lakehouse | On first notebook run |

## Notebooks

| Notebook | Purpose | Input | Output |
|----------|---------|-------|--------|
| `nb_schema_analyzer` | Detect schema richness (Level 0-4) | RDF files | Analysis JSON |
| `nb_preview_generator` | Generate preview data | Project config | Preview tables |
| `nb_translator` | Full RDF→Delta translation | Project config | Node/edge tables |
| `nb_graph_loader` | Load to Fabric Graph | Delta tables | Fabric Graph |

## Dependencies

Notebooks require:
- `rdflib` - RDF parsing library (install via `%pip install rdflib`)
- PySpark runtime (provided by Fabric)

## API

The web/desktop app calls these notebooks via the Fabric REST API:

```
POST /v1/workspaces/{workspaceId}/items/{notebookId}/jobs/instances?jobType=RunNotebook
```

With parameters passed in the request body.
