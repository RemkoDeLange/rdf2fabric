# Fabric Notebooks

Modular PySpark/Scala notebooks for the RDF translation pipeline.

## Naming Convention

```
XX_name_technology.ipynb
```

- `XX` - Execution order (00, 01, 02, 03...)
- `name` - Purpose (orchestrator, rdf_parser, node_extractor, etc.)
- `technology` - Key library used (jena, spark, etc.)

## Pipeline Overview

### Core Translation Pipeline (NB00-NB09)

| # | Notebook | Layer | Description |
|---|----------|-------|-------------|
| 00 | `00_pipeline_orchestrator` | Orchestration | **Server-side orchestrator** — runs NB01-NB09 sequentially, writes progress to OneLake |
| 01 | `01_rdf_parser_jena` | Raw → Bronze | Parse RDF files to `bronze_triples` using Apache Jena (TTL, RDF/XML, JSON-LD, TriG, N-Triples, N-Quads) |
| 02 | `02_schema_detector` | Bronze → Analysis | Detect schema richness level (0-4) and extract statistics (F3.1 + F3.2) |
| 03 | `03_class_to_nodetype` | Bronze → Silver | Map OWL/RDFS classes to node types (`silver_node_types`) — implements **B1, B12** decisions |
| 04 | `04_property_mapping` | Bronze → Silver | Map properties to node properties/edges (`silver_properties`) — implements **B5, B6, B9, B10** decisions |
| 05 | `05_instance_translator` | Bronze → Silver | Translate instances to nodes/edges (`silver_nodes`, `silver_edges`) — implements **B2, B3, B4, B11** decisions |
| 06 | `06_delta_writer` | Silver → Gold | Write gold tables for graph import (`gold_nodes`, `gold_edges`) — implements **B7** decision |
| 07 | `07_ontology_definition_generator` | Silver → Ontology | Generate Fabric Ontology definition from silver tables |
| 08 | `08_ontology_api_client` | Ontology → Fabric | Upload Ontology definition via REST API |
| 09 | `09_data_binding` | Ontology → Graph | Bind Lakehouse tables to Ontology for Graph materialization |

### SHACL Validation (NB10-NB11)

| # | Notebook | Layer | Description |
|---|----------|-------|-------------|
| 10 | `10_shacl_parser` | Bronze → Silver | Parse SHACL shapes to `silver_shacl_shapes` for validation (F6.1) |
| 11 | `11_shacl_validator` | Silver → Validation | Validate data against SHACL shapes |

### External Ontology Enrichment (NB12-NB13)

| # | Notebook | Layer | Description |
|---|----------|-------|-------------|
| 12 | `12_external_ontology_fetcher` | External → Cache | Fetch external ontologies via HTTP (bypasses CORS), caches to `Files/cache/external_ontologies/` |
| 13 | `13_ontology_enrichment` | Cache → Metadata | Extract labels, hierarchies, domains/ranges from cached ontologies to `ontology_metadata.json` |

### Real-Time Intelligence Demo (RTI)

| Notebook | Description |
|----------|-------------|
| `01_eventstream_demo` | Generates simulated OR telemetry events → Eventstream → KQL Database |
| `01_telemetry_backfill` | Backfills 24h of historical telemetry data to Eventstream |
| `02_backfill_simple` | Simplified telemetry backfill variant |

### Testing

| # | Notebook | Description |
|---|----------|-------------|
| 99 | `99_test_runner` | Automated test orchestrator for F2.2, F3.2, F6.1 |

## Decision Implementation

| Decision | Notebook | Options |
|----------|----------|---------|
| B1: Node Type Strategy | NB03 | class, predicate, uri_pattern |
| B2: Blank Node Handling | NB05 | generate, inline, skolemize |
| B3: Multi-Type Resources | NB05 | primary, first, duplicate |
| B4: Named Graph Strategy | NB05 | property, partition, ignore |
| B5: Language Tag Handling | NB04 | suffix, preferred, array |
| B6: Edge Type Derivation | NB04 | property_name, domain_range |
| B7: Datatype Coercion | NB06 | strict, string, infer |
| B9: Edge vs Property | NB04 | all_edges, enum_properties |
| B10: Inverse Properties | NB04 | materialize, single_direction |
| B11: URI → ID Generation | NB05 | local_name, label, hash |
| B12: Hierarchy Strategy | NB03 | flatten, preserve, inherit |

## Server-Side Orchestration (NB00)

The orchestrator pattern ensures reliable pipeline execution:

1. App triggers **NB00** (single notebook job)
2. NB00 runs NB01-NB09 via `mssparkutils.notebook.run()`
3. After each step, NB00 writes progress to `Files/config/pipeline_progress.json`
4. App polls the progress file every 10 seconds
5. Pipeline continues even if browser tab closes

## Parameterized Notebooks

### 01_rdf_parser_jena

Supports Fabric widgets for flexible input configuration:

| Widget | Default | Description |
|--------|---------|-------------|
| `input_paths` | `normative_nen2660,examples_nen2660` | Comma-separated folder/file paths |
| `output_table` | `bronze_triples` | Target Delta table |
| `mode` | `overwrite` | `overwrite` or `append` |

**Manual override:** Edit the widget defaults in the notebook UI, or call via pipeline/test runner with arguments.

## Prerequisites

### Fabric Environment: `env_rdf_jena`

Notebooks using Apache Jena require a custom Fabric Environment with a shaded JAR.

**Build the Shaded JAR:**

```bash
cd tools/jena-shaded
./mvnw.cmd package -DskipTests   # Windows
./mvnw package -DskipTests       # Linux/Mac
```

This creates `target/jena-shaded-4.10.0.jar` (~20MB) with all Jena dependencies and relocated packages to avoid Spark classloader conflicts.

**Setup Steps:**

1. In Fabric workspace → New → **Environment** → name: `env_rdf_jena`
2. Go to **Custom libraries** section
3. Upload: `tools/jena-shaded/target/jena-shaded-4.10.0.jar`
4. **Publish** the environment
5. Attach environment to notebook in notebook settings
6. **Stop and restart session** after attaching environment

## Usage

1. Import notebooks into Fabric workspace
2. Attach lakehouse `lh_rdf_translation_dev_01`
3. Attach environment `env_rdf_jena` (for Jena notebooks)
4. Run notebooks in sequence (01 → 02 → ...)

## Lakehouse Structure

```
lh_rdf_translation_dev_01/
├── Tables/
│   ├── bronze_triples         # Output of 01_rdf_parser_jena
│   ├── bronze_schema_analysis # Output of 02_schema_detector
│   ├── silver_node_types      # Output of 03_class_to_nodetype
│   ├── silver_properties      # Output of 04_property_mapping
│   ├── silver_nodes           # Output of 05_instance_translator
│   ├── silver_edges           # Output of 05_instance_translator
│   ├── gold_nodes             # Output of 06_delta_writer
│   └── gold_edges             # Output of 06_delta_writer
├── Files/
│   ├── raw/                   # User-uploaded RDF files
│   ├── bronze/                # Intermediate parsed data
│   ├── silver/                # Translated nodes/edges
│   ├── gold/                  # Final graph model
│   ├── config/                # Project configuration JSON + pipeline progress
│   ├── cache/                 # External ontology cache
│   │   ├── external_ontologies/   # Cached .ttl/.rdf files (output of NB12)
│   │   ├── fetch_manifest.json    # URIs to fetch (input to NB12)
│   │   ├── fetch_results.json     # Fetch status/errors (output of NB12)
│   │   └── ontology_metadata.json # Extracted metadata (output of NB13)
│   ├── ontology_definitions/  # Generated Ontology definitions (output of NB07)
│   ├── apache_jena_jars/      # Backup of Jena JARs
│   ├── examples_nen2660/      # Shortcut to test data
│   ├── informative_nen2660/   # Shortcut to informative ontology
│   └── normative_nen2660/     # Shortcut to normative ontology
```

## Dependencies

- **Apache Jena 4.10.0** - RDF parsing (loaded via custom Environment)
- **Delta Lake** - Table format (built into Fabric)
- **Spark 3.4+** - Distributed processing (built into Fabric)
