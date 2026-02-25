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
| 02 | `02_schema_detector` | Bronze → Analysis | Detect schema richness level (0-4) for adaptive guidance |
| 03 | `03_class_to_nodetype` | Bronze → Silver | Map OWL/RDFS classes to node types (`silver_node_types`) |
| 04 | `04_property_mapping` | Bronze → Silver | Map properties to node properties and edge types (planned) |
| 05 | `05_instance_translator` | Bronze → Silver | Translate instance data to nodes and edges (planned) |
| 06 | `06_graph_builder` | Silver → Gold | Build final graph model (planned) |

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
│   ├── silver_properties      # Output of 04_property_mapping (planned)
│   ├── silver_nodes           # Output of 05_instance_translator (planned)
│   └── silver_edges           # Output of 05_instance_translator (planned)
├── Files/
│   ├── raw/                   # User-uploaded RDF files
│   ├── bronze/                # Intermediate parsed data
│   ├── silver/                # Translated nodes/edges
│   ├── gold/                  # Final graph model
│   ├── config/                # Project configuration JSON
│   ├── apache_jena_jars/      # Backup of Jena JARs
│   ├── examples_nen2660/      # Shortcut to test data
│   ├── informative_nen2660/   # Shortcut to informative ontology
│   └── normative_nen2660/     # Shortcut to normative ontology
```

## Dependencies

- **Apache Jena 4.10.0** - RDF parsing (loaded via custom Environment)
- **Delta Lake** - Table format (built into Fabric)
- **Spark 3.4+** - Distributed processing (built into Fabric)
