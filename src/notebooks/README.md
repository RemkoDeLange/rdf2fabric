# Fabric Notebooks

Modular PySpark/Scala notebooks for the RDF translation pipeline.

## Naming Convention

```
XX_name_technology.ipynb
```

- `XX` - Execution order (01, 02, 03...)
- `name` - Purpose (rdf_parser, node_extractor, etc.)
- `technology` - Key library used (jena, spark, etc.)

## Pipeline Overview

| # | Notebook | Layer | Description |
|---|----------|-------|-------------|
| 01 | `01_rdf_parser_jena` | Raw → Bronze | Parse TTL files to `bronze_triples` using Apache Jena |
| 02 | `02_prefix_resolver` | Bronze | Expand prefixed URIs to full URIs (planned) |
| 03 | `03_node_extractor` | Bronze → Silver | Extract distinct nodes with types to `silver_nodes` (planned) |
| 04 | `04_edge_extractor` | Bronze → Silver | Extract relationships to `silver_edges` (planned) |
| 05 | `05_graph_builder` | Silver → Gold | Build final graph model (planned) |

## Prerequisites

### Fabric Environment: `env_rdf_jena`

Notebooks using Apache Jena require a custom Fabric Environment with JAR uploads.

**Setup Steps:**
1. In Fabric workspace → New → **Environment** → name: `env_rdf_jena`
2. Go to **Custom libraries** section
3. Upload these JARs (download from Maven Central):
   - [jena-arq-4.10.0.jar](https://repo1.maven.org/maven2/org/apache/jena/jena-arq/4.10.0/jena-arq-4.10.0.jar)
   - [jena-core-4.10.0.jar](https://repo1.maven.org/maven2/org/apache/jena/jena-core/4.10.0/jena-core-4.10.0.jar)
   - [jena-base-4.10.0.jar](https://repo1.maven.org/maven2/org/apache/jena/jena-base/4.10.0/jena-base-4.10.0.jar)
   - [jena-iri-4.10.0.jar](https://repo1.maven.org/maven2/org/apache/jena/jena-iri/4.10.0/jena-iri-4.10.0.jar)
   - [caffeine-3.1.8.jar](https://repo1.maven.org/maven2/com/github/benmanes/caffeine/caffeine/3.1.8/caffeine-3.1.8.jar)
4. **Publish** the environment
5. Attach environment to notebook in notebook settings

> **Note:** JARs are also stored in `Files/apache_jena_jars/` in the lakehouse as backup.

## Usage

1. Import notebooks into Fabric workspace
2. Attach lakehouse `lh_rdf_translation_dev_01`
3. Attach environment `env_rdf_jena` (for Jena notebooks)
4. **Stop and restart session** after attaching environment
5. Run notebooks in sequence (01 → 02 → ...)

## Lakehouse Structure

```
lh_rdf_translation_dev_01/
├── Tables/
│   ├── bronze_triples      # Output of 01_rdf_parser_jena
│   ├── silver_nodes        # Output of 03_node_extractor (planned)
│   └── silver_edges        # Output of 04_edge_extractor (planned)
├── Files/
│   ├── raw/                # User-uploaded RDF files
│   ├── bronze/             # Intermediate parsed data
│   ├── silver/             # Translated nodes/edges
│   ├── gold/               # Final graph model
│   ├── config/             # Project configuration JSON
│   ├── apache_jena_jars/   # Backup of Jena JARs
│   ├── examples_nen2660/   # Shortcut to test data
│   ├── informative_nen2660/# Shortcut to informative ontology
│   └── normative_nen2660/  # Shortcut to normative ontology
```

## Dependencies

- **Apache Jena 4.10.0** - RDF parsing (loaded via custom Environment)
- **Delta Lake** - Table format (built into Fabric)
- **Spark 3.4+** - Distributed processing (built into Fabric)
