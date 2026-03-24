# RDF2Fabric User Guide

> **Version:** 0.2.1 (March 2026)  
> **Status:** Proof of Concept

Welcome to RDF2Fabric — a tool for translating RDF (Semantic Web) data into Microsoft Fabric Graph.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Understanding the Pipeline](#understanding-the-pipeline)
4. [Supported RDF Formats](#supported-rdf-formats)
5. [Additional Resources](#additional-resources)

---

## Installation

### Prerequisites

Before installing RDF2Fabric, ensure you have:

| Requirement | Details |
|-------------|---------|
| **Microsoft Fabric Workspace** | F64 capacity or higher recommended |
| **Lakehouse** | One lakehouse in your workspace |
| **Fabric Environment** | Custom environment for Apache Jena JAR |
| **Node.js** (for web app) | v18+ recommended |
| **Git** | For repository access |

### Step 1: Clone the Repository

```bash
git clone https://github.com/RemkoDeLange/rdf2fabric.git
cd rdf2fabric
```

### Step 2: Build the Apache Jena JAR

The pipeline uses Apache Jena for RDF parsing. Build the shaded JAR:

```bash
cd tools/jena-shaded

# Windows
./mvnw.cmd package -DskipTests

# Linux/Mac
./mvnw package -DskipTests
```

This creates `target/jena-shaded-4.10.0.jar` (~20MB).

### Step 3: Set Up Fabric Environment

1. In your Fabric workspace → **New** → **Environment**
2. Name it `env_rdf_jena`
3. Go to **Custom libraries**
4. Upload `tools/jena-shaded/target/jena-shaded-4.10.0.jar`
5. Click **Publish**

### Step 4: Import Notebooks

Import the notebooks from `src/notebooks/` into your Fabric workspace:

| Notebook | Purpose |
|----------|---------|
| `00_pipeline_orchestrator.ipynb` | Orchestrates the full pipeline |
| `01_rdf_parser_jena.ipynb` | Parses RDF files to bronze layer |
| `02_schema_detector.ipynb` | Detects schema richness level |
| `03_class_to_nodetype.ipynb` | Maps classes to entity types |
| `04_property_mapping.ipynb` | Maps properties to attributes/edges |
| `05_instance_translator.ipynb` | Translates instances to nodes/edges |
| `06_delta_writer.ipynb` | Writes gold tables |
| `07_ontology_definition_generator.ipynb` | Generates Fabric Ontology |
| `08_ontology_api_client.ipynb` | Uploads to Fabric API |
| `09_data_binding.ipynb` | Binds data for Graph materialization |

### Step 5: Create Lakehouse

1. In your workspace → **New** → **Lakehouse**
2. Name it `lh_rdf_translation_dev_01`
3. Create folders under **Files/**:
   - `raw/` - For uploaded RDF files
   - `config/` - For pipeline configuration
   - `cache/` - For external ontology cache

### Step 6: Install Web App (Optional)

The React app provides a UI for decision-making and pipeline execution:

```bash
cd src/app
npm install
npm run dev
```

The app runs at http://localhost:5173

---

## Quick Start

### Option A: Using the Web App

1. **Start the app:** `cd src/app && npm run dev`
2. **Sign in** with your Microsoft account
3. **Configure workspace** in Settings (enter your workspace URL)
4. **Create a new project** and select your RDF source files
5. **Set schema level** (0-4) or use auto-detect
6. **Review decisions** on the Decision Dashboard
7. **Execute the pipeline** and monitor progress

### Option B: Using Notebooks Directly

1. **Upload RDF files** to your lakehouse under `Files/raw/`
2. **Create config file** at `Files/config/pipeline_run.json`:

```json
{
  "projectId": "my-project",
  "sourcePaths": ["raw/my-data.ttl"],
  "schemaLevel": 3,
  "decisions": {
    "B1": "class",
    "B2": "generate",
    "B3": "primary",
    "B4": "property",
    "B5": "suffix",
    "B6": "property",
    "B7": "strict",
    "B9": "all-edges",
    "B10": "materialize",
    "B11": "local-name",
    "B12": "flatten"
  }
}
```

3. **Run the orchestrator** (`00_pipeline_orchestrator.ipynb`)
4. **Check results** in the Fabric Graph via GQL queries

---

## Understanding the Pipeline

### Data Flow

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  RDF Files  │ → │   Bronze    │ → │   Silver    │ → │    Gold     │
│  (.ttl, etc)│   │  (triples)  │   │(nodes/edges)│   │ (per-type)  │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────┐
                                                    │ Fabric Ontology │
                                                    │   + Graph       │
                                                    └─────────────────┘
```

### Schema Levels

The pipeline behavior adapts based on detected schema richness:

| Level | Name | Description | Auto-Resolved Decisions |
|-------|------|-------------|------------------------|
| 0 | Instance-only | No schema, just data | 0 |
| 1 | SKOS | Vocabulary/taxonomy | 1 (B12) |
| 2 | RDFS | Class/property definitions | 3 (B1, B6, B12) |
| 3 | OWL | Full ontology with restrictions | 6 (B1, B6, B7, B9, B10, B12) |
| 4 | SHACL | Schema + validation shapes | 7 (B1, B6, B7, B8, B9, B10, B12) |

Higher schema levels = more decisions auto-resolved = less manual configuration.

---

## Supported RDF Formats

| Format | Extensions | Description |
|--------|------------|-------------|
| **Turtle** | `.ttl` | Compact, human-readable |
| **RDF/XML** | `.rdf`, `.xml`, `.owl` | XML-based, widely supported |
| **N-Triples** | `.nt` | Line-based, simple |
| **N-Quads** | `.nq` | N-Triples with named graphs |
| **JSON-LD** | `.jsonld`, `.json` | JSON-based linked data |
| **TriG** | `.trig` | Turtle with named graphs |

---

## Additional Resources

- [Decision Reference](decision-reference.md) — All 12 B-decisions explained
- [Troubleshooting](troubleshooting.md) — Common issues and solutions
- [Architecture](../architecture.md) — System design details
- [NEN 2660-2 Test Data](../data-sources.md) — Test data information
