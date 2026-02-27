# RDF2Fabric - Feature Backlog

> **Purpose:** Comprehensive feature list with acceptance criteria and tests.  
> **Last Updated:** 2026-02-24  
> **Version:** v0.1.0 (Documentation Complete)

---

## Overview

This backlog tracks all features needed to build RDF2Fabric. Each feature includes:
- **Acceptance Criteria** - What "done" looks like
- **Tests** - How we verify it works
- **Dependencies** - What must be completed first
- **Estimate** - Rough effort (S/M/L/XL)

### Priority Legend
| Priority | Meaning |
|----------|---------|
| 🔴 P0 | Critical - Blocks everything |
| 🟠 P1 | High - Core functionality |
| 🟡 P2 | Medium - Important but not blocking |
| 🟢 P3 | Low - Nice to have |

### Status Legend
| Status | Meaning |
|--------|---------|
| ⬜ Not Started | Work not begun |
| 🔄 In Progress | Currently being worked on |
| ✅ Complete | Done and tested |
| 🚫 Blocked | Waiting on dependency |

---

## Epic 1: Infrastructure Setup

### F1.1 - Fabric Workspace Configuration ✅
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** S

**Description:** Set up development Fabric workspace with Git integration.

**Acceptance Criteria:**
- [x] Workspace `ws-rdf_translation-dev-01` created
- [x] Git integration connected to `RemkoDeLange/rdf2fabric`
- [x] Sync folder set to `/fabric`

**Tests:** Manual verification in Fabric portal.

---

### F1.2 - Lakehouse Setup
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** S

**Description:** Create lakehouse for intermediate data storage.

**Implementation Notes:**
- Lakehouse: `lh_rdf_translation_dev_01` in `ws-rdf_translation-dev-01`
- Created manually (MCP API limitation)
- Folders created via placeholder file upload workaround

**Acceptance Criteria:**
- [x] Lakehouse `lh_rdf_translation_dev_01` created in workspace
- [x] Folders created: `/raw`, `/bronze`, `/silver`, `/gold`, `/config`
- [x] Shortcut to test data (`ws-ont_nen2660-dev-01/lh_nen2660data_dev_01`)

**Tests:**
```python
# test_lakehouse_setup.py
def test_lakehouse_exists():
    """Verify lakehouse is accessible."""
    assert lakehouse_exists("lh_rdf_translation_dev_01")

def test_required_folders_exist():
    """Verify folder structure."""
    folders = ["raw", "bronze", "silver", "gold", "config"]
    for folder in folders:
        assert folder_exists(f"Files/{folder}")

def test_shortcut_accessible():
    """Verify shortcut to NEN 2660 test data."""
    assert file_exists("Files/shortcuts/nen2660/normative_nen2660")
```

**Dependencies:** F1.1

---

### F1.3 - Test Data Validation
**Priority:** 🟠 P1 | **Status:** ✅ Complete | **Estimate:** S

**Description:** Verify NEN 2660 test data is accessible and correctly structured.

**Implementation Notes:**
- Shortcuts created at Files level (not Tables)
- 4 example TTL files successfully parsed (1,237 triples)

**Acceptance Criteria:**
- [x] All normative files accessible (nen2660-term.ttl, nen2660-rdfs.ttl, nen2660-owl.ttl, nen2660-shacl.ttl)
- [x] All informative files accessible (nen2660.trig, nen2660.jsonld, nen2660.ttl, nen2660.rdf)
- [x] Example files accessible (IJsselbrug.ttl, Liggerbrug.ttl, etc.)
- [x] Files are valid RDF (parseable)

**Tests:**
```python
# test_test_data.py
import pytest

NORMATIVE_FILES = [
    "normative_nen2660/nen2660-term.ttl",
    "normative_nen2660/nen2660-rdfs.ttl",
    "normative_nen2660/nen2660-owl.ttl",
    "normative_nen2660/nen2660-shacl.ttl",
]

INFORMATIVE_FILES = [
    "informative_nen2660/nen2660.trig",
    "informative_nen2660/nen2660.jsonld",
    "informative_nen2660/nen2660.ttl",
    "informative_nen2660/nen2660.rdf",
]

EXAMPLE_FILES = [
    "examples_nen2660/IJsselbrug.ttl",
    "examples_nen2660/Liggerbrug.ttl",
]

@pytest.mark.parametrize("file_path", NORMATIVE_FILES + INFORMATIVE_FILES + EXAMPLE_FILES)
def test_file_exists(file_path):
    """Verify test data file exists."""
    assert file_exists(f"Files/{file_path}")

@pytest.mark.parametrize("file_path", NORMATIVE_FILES + EXAMPLE_FILES)
def test_file_is_valid_rdf(file_path):
    """Verify file can be parsed as RDF."""
    graph = parse_rdf(f"Files/{file_path}")
    assert len(graph) > 0
```

**Dependencies:** F1.2

---

## Epic 2: RDF Parsing (Backend - Scala/Python)

### F2.1 - Basic RDF Parser (Turtle)
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** M

**Description:** Parse Turtle (.ttl) files using Apache Jena in Scala notebook.

**Implementation Notes:**
- Notebook: `src/notebooks/01_rdf_parser_jena.ipynb`
- Requires shaded JAR: `tools/jena-shaded/target/jena-shaded-4.10.0.jar`
- Environment: `env_rdf_jena` with custom JAR upload
- Output: `bronze_triples` Delta table (1,237 triples from test data)

**Acceptance Criteria:**
- [x] Parse single .ttl file into Spark DataFrame
- [x] Extract: subject, predicate, object, datatype, language
- [x] Handle IRIs, literals, and blank nodes
- [x] Return triple count and parse errors

**Tests:**
```scala
// test_turtle_parser.scala
class TurtleParserTest extends AnyFunSuite {
  
  test("parse simple turtle file") {
    val df = parseTurtle("Files/examples_nen2660/IJsselbrug.ttl")
    assert(df.count() > 0)
    assert(df.columns.contains("subject"))
    assert(df.columns.contains("predicate"))
    assert(df.columns.contains("object"))
  }
  
  test("handle blank nodes") {
    val df = parseTurtle("Files/test/blank_nodes.ttl")
    val blanks = df.filter(col("subject").startsWith("_:"))
    assert(blanks.count() > 0)
  }
  
  test("extract literal datatypes") {
    val df = parseTurtle("Files/test/datatypes.ttl")
    assert(df.filter(col("datatype") === "xsd:integer").count() > 0)
    assert(df.filter(col("datatype") === "xsd:string").count() > 0)
  }
  
  test("extract language tags") {
    val df = parseTurtle("Files/test/languages.ttl")
    assert(df.filter(col("language") === "nl").count() > 0)
    assert(df.filter(col("language") === "en").count() > 0)
  }
}
```

**Dependencies:** F1.2

---

### F2.2 - Multi-Format RDF Parser
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Extend parser to support all common RDF formats.

**Acceptance Criteria:**
- [ ] Support Turtle (.ttl)
- [ ] Support RDF/XML (.rdf, .xml)
- [ ] Support N-Triples (.nt)
- [ ] Support N-Quads (.nq)
- [ ] Support JSON-LD (.jsonld)
- [ ] Support TriG (.trig) with named graphs
- [ ] Auto-detect format from file extension or content

**Tests:**
```scala
// test_multi_format_parser.scala
class MultiFormatParserTest extends AnyFunSuite {
  
  val formats = Map(
    "turtle" -> "test.ttl",
    "rdfxml" -> "test.rdf",
    "ntriples" -> "test.nt",
    "jsonld" -> "test.jsonld",
    "trig" -> "test.trig"
  )
  
  formats.foreach { case (format, file) =>
    test(s"parse $format format") {
      val df = parseRdf(s"Files/test/$file")
      assert(df.count() > 0)
    }
  }
  
  test("auto-detect format from extension") {
    val format = detectFormat("example.ttl")
    assert(format == "turtle")
  }
  
  test("auto-detect format from content") {
    val content = "@prefix : <http://example.org/> ."
    val format = detectFormatFromContent(content)
    assert(format == "turtle")
  }
  
  test("parse trig with named graphs") {
    val df = parseRdf("Files/informative_nen2660/nen2660.trig")
    assert(df.columns.contains("graph"))
    assert(df.filter(col("graph").isNotNull).count() > 0)
  }
}
```

**Dependencies:** F2.1

---

### F2.3 - Large File Streaming Parser
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** L

**Description:** Handle large RDF files (>1M triples) using streaming.

**Acceptance Criteria:**
- [ ] Stream parse without loading entire file in memory
- [ ] Process files up to 10GB
- [ ] Configurable batch size
- [ ] Progress reporting (% complete)
- [ ] Memory usage stays below configured limit

**Tests:**
```scala
// test_streaming_parser.scala
class StreamingParserTest extends AnyFunSuite {
  
  test("parse large file with bounded memory") {
    val memBefore = Runtime.getRuntime.totalMemory()
    val df = parseRdfStreaming("Files/test/large_10m_triples.ttl", batchSize = 100000)
    val memAfter = Runtime.getRuntime.totalMemory()
    
    assert(df.count() == 10000000)
    assert(memAfter - memBefore < 2L * 1024 * 1024 * 1024) // < 2GB increase
  }
  
  test("report progress during parsing") {
    var progressUpdates = List[Int]()
    parseRdfStreaming("Files/test/large.ttl", onProgress = p => progressUpdates :+= p)
    
    assert(progressUpdates.contains(25))
    assert(progressUpdates.contains(50))
    assert(progressUpdates.contains(75))
    assert(progressUpdates.contains(100))
  }
}
```

**Dependencies:** F2.2

---

### F2.4 - External Ontology Dereferencing
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** M | **Phase:** 2

**Description:** Automatically fetch referenced ontologies from external URIs found in RDF data.

When RDF instance data references external classes/properties (e.g., `rdf:type <https://w3id.org/nen2660/def#PhysicalObject>`), the application should offer to dereference those URIs to retrieve schema definitions. This follows the Linked Data "follow your nose" principle.

**User Flow:**
1. Parse input RDF files
2. Detect external namespace URIs (not in provided files)
3. Display list to user: "Found references to external ontologies"
4. User selects which to fetch (or skip for manual upload)
5. Fetch via HTTP with content negotiation (Accept: text/turtle, application/rdf+xml)
6. Merge fetched schema into bronze layer
7. Re-run schema detection (may upgrade level 0 → level 2+)

**Acceptance Criteria:**
- [ ] Extract unique namespace prefixes from parsed triples
- [ ] Identify namespaces not present in provided files
- [ ] HTTP fetch with proper content negotiation headers
- [ ] Handle common responses: Turtle, RDF/XML, JSON-LD
- [ ] Cache fetched ontologies locally (avoid re-fetching)
- [ ] Graceful handling of: timeouts, 404s, non-RDF responses
- [ ] User can skip/defer external fetching
- [ ] Display consequences: "Without this ontology, you'll have X more decisions"

**Tests:**
```python
# test_external_dereferencing.py
class ExternalDereferencingTest:
    
    def test_detect_external_namespaces(self):
        df_triples = parse_rdf("local_instances.ttl")
        external_ns = detect_external_namespaces(df_triples)
        
        assert "https://w3id.org/nen2660/def#" in external_ns
        assert "http://www.w3.org/2000/01/rdf-schema#" not in external_ns  # well-known, skip
    
    def test_fetch_with_content_negotiation(self):
        result = fetch_ontology("https://w3id.org/nen2660/def")
        
        assert result.format in ["turtle", "rdf/xml", "json-ld"]
        assert len(result.triples) > 0
    
    def test_handles_timeout_gracefully(self):
        result = fetch_ontology("https://unreachable.example.org/ont", timeout=5)
        
        assert result.success == False
        assert "timeout" in result.error.lower()
    
    def test_user_can_skip_external(self):
        # User chooses not to fetch - should continue with lower schema level
        external_ns = ["https://example.org/ont#"]
        user_skip = ["https://example.org/ont#"]
        
        result = process_with_user_decisions(external_ns, skip=user_skip)
        assert result.schema_level == 0  # No auto-upgrade
```

**Technical Notes:**
- Use requests library with proper headers
- Respect robots.txt and rate limiting
- Cache in Lakehouse Files/cache/external_ontologies/
- Well-known prefixes (rdf, rdfs, owl, xsd, skos) should be built-in, not fetched

**Dependencies:** F2.1, F3.1

---

## Epic 3: Schema Detection

### F3.1 - Schema Richness Detector (5 Levels)
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** L

**Description:** Detect schema richness level (0-4) from RDF data.

**Schema Levels:**
| Level | Name | Indicators |
|-------|------|------------|
| 0 | No Schema | Only rdf:type, no class/property definitions |
| 1 | SKOS Terms | skos:Concept, skos:prefLabel, skos:broader |
| 2 | RDFS Classes | rdfs:Class, rdfs:subClassOf, rdfs:domain, rdfs:range |
| 3 | OWL Ontology | owl:Class, owl:ObjectProperty, owl:DatatypeProperty |
| 4 | SHACL Shapes | sh:NodeShape, sh:PropertyShape, sh:path |

**Acceptance Criteria:**
- [ ] Detect level 0: data-only files
- [ ] Detect level 1: SKOS vocabularies
- [ ] Detect level 2: RDFS schemas
- [ ] Detect level 3: OWL ontologies
- [ ] Detect level 4: SHACL shapes present
- [ ] Return confidence score (low/medium/high)
- [ ] List specific constructs found

**Tests:**
```python
# test_schema_detector.py
import pytest

class TestSchemaDetector:
    
    def test_level_0_data_only(self):
        """File with only instance data, no schema."""
        result = detect_schema_level("test/level0_data_only.ttl")
        assert result.level == 0
        assert result.confidence == "high"
    
    def test_level_1_skos(self):
        """SKOS vocabulary file."""
        result = detect_schema_level("normative_nen2660/nen2660-term.ttl")
        assert result.level >= 1
        assert "skos:Concept" in result.constructs_found
    
    def test_level_2_rdfs(self):
        """RDFS schema file."""
        result = detect_schema_level("normative_nen2660/nen2660-rdfs.ttl")
        assert result.level >= 2
        assert "rdfs:Class" in result.constructs_found
    
    def test_level_3_owl(self):
        """OWL ontology file."""
        result = detect_schema_level("normative_nen2660/nen2660-owl.ttl")
        assert result.level >= 3
        assert "owl:Class" in result.constructs_found
    
    def test_level_4_shacl(self):
        """SHACL shapes file."""
        result = detect_schema_level("normative_nen2660/nen2660-shacl.ttl")
        assert result.level == 4
        assert "sh:NodeShape" in result.constructs_found
    
    def test_combined_schema_and_data(self):
        """File with both schema and instance data."""
        result = detect_schema_level("informative_nen2660/nen2660.ttl")
        assert result.level >= 2
        assert result.has_instance_data == True
        assert result.has_schema == True
    
    def test_multiple_files(self):
        """Detect combined schema level from multiple files."""
        files = [
            "normative_nen2660/nen2660-rdfs.ttl",
            "normative_nen2660/nen2660-owl.ttl",
            "examples_nen2660/IJsselbrug.ttl"
        ]
        result = detect_schema_level_combined(files)
        assert result.level == 3  # OWL is highest
```

**Dependencies:** F2.1

---

### F3.2 - Schema Statistics Extractor
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Extract detailed statistics from schema for UI display.

**Acceptance Criteria:**
- [ ] Count classes defined
- [ ] Count properties (datatype + object)
- [ ] Count instances per class
- [ ] List class hierarchy (subClassOf)
- [ ] List property domains and ranges
- [ ] Count named graphs (if present)
- [ ] Return in JSON format for UI

**Tests:**
```python
# test_schema_statistics.py
class TestSchemaStatistics:
    
    def test_count_classes(self):
        stats = extract_schema_stats("normative_nen2660/nen2660-rdfs.ttl")
        assert stats["class_count"] > 0
        assert "classes" in stats
    
    def test_count_properties(self):
        stats = extract_schema_stats("normative_nen2660/nen2660-owl.ttl")
        assert stats["datatype_property_count"] > 0
        assert stats["object_property_count"] > 0
    
    def test_count_instances(self):
        stats = extract_schema_stats("examples_nen2660/IJsselbrug.ttl")
        assert stats["instance_count"] > 0
        assert "instances_by_class" in stats
    
    def test_class_hierarchy(self):
        stats = extract_schema_stats("normative_nen2660/nen2660-rdfs.ttl")
        hierarchy = stats["class_hierarchy"]
        assert len(hierarchy) > 0
        # Should have parent-child relationships
        assert any(c["parent"] is not None for c in hierarchy)
    
    def test_output_json_format(self):
        stats = extract_schema_stats("normative_nen2660/nen2660-owl.ttl")
        # Should be JSON serializable
        import json
        json_str = json.dumps(stats)
        assert len(json_str) > 0
```

**Dependencies:** F3.1

---

## Epic 4: RDF → LPG Translation

### F4.1 - Class to Node Type Mapping
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** M

**Description:** Translate OWL/RDFS classes to Fabric Graph node types.

**Translation Rules:**
| RDF Construct | LPG Equivalent |
|---------------|----------------|
| owl:Class / rdfs:Class | Node Type (label) |
| rdfs:subClassOf | Node Type hierarchy (labels) |
| rdf:type | Node label assignment |

**Acceptance Criteria:**
- [ ] Map each owl:Class to a node type name
- [ ] Handle class hierarchy (flatten or preserve as multiple labels)
- [ ] Generate unique, valid node type names (no special chars)
- [ ] Handle anonymous classes (generate stable ID)
- [ ] Preserve rdfs:label as display name

**Tests:**
```python
# test_class_mapping.py
class TestClassMapping:
    
    def test_map_owl_class(self):
        mapping = map_classes_to_node_types("normative_nen2660/nen2660-owl.ttl")
        assert len(mapping) > 0
        # Check a known class
        assert "PhysicalObject" in [m["node_type"] for m in mapping]
    
    def test_valid_node_type_names(self):
        mapping = map_classes_to_node_types("normative_nen2660/nen2660-owl.ttl")
        for m in mapping:
            name = m["node_type"]
            # No special characters
            assert not any(c in name for c in [" ", ",", ";", "{", "}", "(", ")"])
    
    def test_preserve_labels(self):
        mapping = map_classes_to_node_types("normative_nen2660/nen2660-owl.ttl")
        # Should have display names
        assert any(m.get("display_name") is not None for m in mapping)
    
    def test_handle_class_hierarchy(self):
        mapping = map_classes_to_node_types("normative_nen2660/nen2660-rdfs.ttl")
        # Should track parent classes
        assert any(m.get("parent_types") is not None for m in mapping)
```

**Dependencies:** F3.1

---

### F4.2 - Property to Node Property / Edge Mapping
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** M

**Description:** Translate OWL properties to node properties and edge types.

**Translation Rules:**
| RDF Construct | LPG Equivalent |
|---------------|----------------|
| owl:DatatypeProperty | Node property |
| owl:ObjectProperty | Edge type |
| rdfs:domain | Source node type for edge |
| rdfs:range (datatype) | Property data type |
| rdfs:range (class) | Target node type for edge |

**Acceptance Criteria:**
- [x] Map DatatypeProperty → node property with type
- [x] Map ObjectProperty → edge type
- [x] Use rdfs:domain to assign properties to node types
- [x] Use rdfs:range to determine data type or target
- [x] Handle properties without domain/range (assign to generic)
- [x] Handle multi-domain and multi-range properties

**Implementation Notes:**
- Notebook: `src/notebooks/04_property_mapping.ipynb`
- Output: `silver_properties` Delta table
- XSD types mapped to Spark types (string, integer, boolean, timestamp, etc.)
- Supports labels, descriptions, inverse relationships, functional property detection

**Tests:**
```python
# test_property_mapping.py
class TestPropertyMapping:
    
    def test_map_datatype_property(self):
        mapping = map_properties("normative_nen2660/nen2660-owl.ttl")
        datatype_props = [m for m in mapping if m["type"] == "node_property"]
        assert len(datatype_props) > 0
    
    def test_map_object_property(self):
        mapping = map_properties("normative_nen2660/nen2660-owl.ttl")
        edges = [m for m in mapping if m["type"] == "edge"]
        assert len(edges) > 0
    
    def test_property_has_domain(self):
        mapping = map_properties("normative_nen2660/nen2660-owl.ttl")
        # At least some properties should have domains
        with_domain = [m for m in mapping if m.get("domain")]
        assert len(with_domain) > 0
    
    def test_datatype_property_has_type(self):
        mapping = map_properties("normative_nen2660/nen2660-owl.ttl")
        datatype_props = [m for m in mapping if m["type"] == "node_property"]
        # Should have data types like string, integer, etc.
        assert any(m.get("data_type") is not None for m in datatype_props)
    
    def test_edge_has_target(self):
        mapping = map_properties("normative_nen2660/nen2660-owl.ttl")
        edges = [m for m in mapping if m["type"] == "edge"]
        # Object properties should have target node types
        assert any(m.get("target_type") is not None for m in edges)
```

**Dependencies:** F4.1

---

### F4.3 - Instance Data Translation
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** L

**Description:** Translate RDF instance data (triples) to node and edge records.

**Acceptance Criteria:**
- [x] Create node record for each unique subject with rdf:type
- [x] Extract node ID from subject IRI
- [x] Assign node labels from rdf:type
- [x] Extract node properties from datatype property triples
- [x] Create edge records from object property triples
- [x] Handle blank nodes (generate stable IDs)
- [x] Handle multi-valued properties

**Implementation Notes:**
- Notebook: `src/notebooks/05_instance_translator.ipynb`
- Outputs: `silver_nodes` and `silver_edges` Delta tables
- Filters out schema definitions (owl:Class, owl:ObjectProperty, etc.) to focus on instance data
- Node ID generation: local name for URIs, hash-based stable IDs for blank nodes
- Properties pivoted to map column per node

**Tests:**
```python
# test_instance_translation.py
class TestInstanceTranslation:
    
    def test_create_nodes_from_instances(self):
        schema = load_schema("normative_nen2660/nen2660-owl.ttl")
        nodes = translate_instances_to_nodes(
            "examples_nen2660/IJsselbrug.ttl",
            schema
        )
        assert len(nodes) > 0
    
    def test_node_has_id(self):
        schema = load_schema("normative_nen2660/nen2660-owl.ttl")
        nodes = translate_instances_to_nodes("examples_nen2660/IJsselbrug.ttl", schema)
        for node in nodes:
            assert "id" in node
            assert node["id"] is not None
    
    def test_node_has_labels(self):
        schema = load_schema("normative_nen2660/nen2660-owl.ttl")
        nodes = translate_instances_to_nodes("examples_nen2660/IJsselbrug.ttl", schema)
        for node in nodes:
            assert "labels" in node
            assert len(node["labels"]) > 0
    
    def test_node_has_properties(self):
        schema = load_schema("normative_nen2660/nen2660-owl.ttl")
        nodes = translate_instances_to_nodes("examples_nen2660/IJsselbrug.ttl", schema)
        # At least some nodes should have properties
        assert any(len(n.get("properties", {})) > 0 for n in nodes)
    
    def test_create_edges(self):
        schema = load_schema("normative_nen2660/nen2660-owl.ttl")
        edges = translate_instances_to_edges("examples_nen2660/IJsselbrug.ttl", schema)
        assert len(edges) > 0
    
    def test_edge_has_source_and_target(self):
        schema = load_schema("normative_nen2660/nen2660-owl.ttl")
        edges = translate_instances_to_edges("examples_nen2660/IJsselbrug.ttl", schema)
        for edge in edges:
            assert "source_id" in edge
            assert "target_id" in edge
            assert "type" in edge
    
    def test_handle_blank_nodes(self):
        nodes = translate_instances_to_nodes("test/with_blank_nodes.ttl", schema)
        blank_nodes = [n for n in nodes if n["id"].startswith("_:") or n.get("is_blank")]
        assert len(blank_nodes) > 0
        # Blank nodes should have stable IDs
        assert all(n["id"] is not None for n in blank_nodes)
```

**Dependencies:** F4.1, F4.2, F2.1

---

### F4.4 - Delta Table Writer
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** M

**Description:** Write translated nodes and edges to Delta Lake tables.

**Table Schema:**

**Nodes Table:**
| Column | Type | Description |
|--------|------|-------------|
| id | STRING | Unique node identifier |
| labels | ARRAY<STRING> | Node type labels |
| properties | MAP<STRING, STRING> | Property key-value pairs |

**Edges Table:**
| Column | Type | Description |
|--------|------|-------------|
| source_id | STRING | Source node ID |
| target_id | STRING | Target node ID |
| type | STRING | Edge type name |
| properties | MAP<STRING, STRING> | Edge properties (if any) |

**Acceptance Criteria:**
- [x] Write nodes to `Tables/gold_nodes` Delta table
- [x] Write edges to `Tables/gold_edges` Delta table
- [x] Support incremental append (for large files)
- [x] Support overwrite mode (for re-translation)
- [x] Partition by label for query performance (optional)
- [x] Create/update table schema automatically

**Implementation Notes:**
- Notebook: `src/notebooks/06_delta_writer.ipynb`
- Outputs: `gold_nodes` and `gold_edges` Delta tables
- Configurable write mode (overwrite/append)
- Validation checks for edge references and null IDs

**Tests:**
```python
# test_delta_writer.py
class TestDeltaWriter:
    
    def test_write_nodes_table(self):
        nodes = [{"id": "n1", "labels": ["Person"], "properties": {"name": "John"}}]
        write_nodes_to_delta(nodes, "Tables/test_nodes")
        
        df = spark.read.format("delta").load("Tables/test_nodes")
        assert df.count() == 1
    
    def test_write_edges_table(self):
        edges = [{"source_id": "n1", "target_id": "n2", "type": "KNOWS", "properties": {}}]
        write_edges_to_delta(edges, "Tables/test_edges")
        
        df = spark.read.format("delta").load("Tables/test_edges")
        assert df.count() == 1
    
    def test_append_mode(self):
        nodes1 = [{"id": "n1", "labels": ["A"], "properties": {}}]
        nodes2 = [{"id": "n2", "labels": ["B"], "properties": {}}]
        
        write_nodes_to_delta(nodes1, "Tables/test_append", mode="overwrite")
        write_nodes_to_delta(nodes2, "Tables/test_append", mode="append")
        
        df = spark.read.format("delta").load("Tables/test_append")
        assert df.count() == 2
    
    def test_overwrite_mode(self):
        nodes1 = [{"id": "n1", "labels": ["A"], "properties": {}}]
        nodes2 = [{"id": "n2", "labels": ["B"], "properties": {}}]
        
        write_nodes_to_delta(nodes1, "Tables/test_overwrite", mode="overwrite")
        write_nodes_to_delta(nodes2, "Tables/test_overwrite", mode="overwrite")
        
        df = spark.read.format("delta").load("Tables/test_overwrite")
        assert df.count() == 1  # Overwritten
```

**Dependencies:** F4.3

---

## Epic 5: Fabric Ontology Integration

> **Architecture Update (2026-02-25):** Changed from Graph Model JSON approach to Fabric Ontology.
> Fabric Ontology is a first-class item that provides:
> - Entity types, properties, and relationships (the schema)
> - Data binding to Lakehouse/Eventhouse tables
> - Automatic Graph materialization for querying
> - Data Agent support for natural language queries (NL2Ontology)
>
> The REST API at `/v1/workspaces/{workspaceId}/ontologies` supports programmatic creation and updates.

### F5.1 - Ontology Definition Generator
**Priority:** 🔴 P0 | **Status:** ✅ Complete | **Estimate:** L

**Description:** Generate Fabric Ontology definition from silver layer schema tables.

**Ontology Definition Structure:** (base64-encoded JSON parts)
```
definition.json                                    → Root definition
EntityTypes/{id}/definition.json                   → Entity type (name, properties, key)  
EntityTypes/{id}/DataBindings/{bindingId}.json     → Data binding to lakehouse table
RelationshipTypes/{id}/definition.json             → Relationships between entity types
.platform                                          → Metadata
```

**Entity Type Definition Example:**
```json
{
  "id": "8813598896083",
  "namespace": "usertypes",
  "name": "PhysicalObject",
  "entityIdParts": ["propertyId_for_key"],
  "displayNamePropertyId": "propertyId_for_display",
  "properties": [
    {"id": "prop1", "name": "name", "dataType": "String"},
    {"id": "prop2", "name": "description", "dataType": "String"}
  ]
}
```

**Acceptance Criteria:**
- [ ] Generate entity type definitions from `silver_node_types` table
- [ ] Generate property definitions with correct Fabric data types
- [ ] Generate relationship type definitions from `silver_properties` (object properties)
- [ ] Map RDF datatypes to Fabric Ontology types (String, BigInt, Double, Boolean, DateTime)
- [ ] Validate entity/property names (1-26 chars, alphanumeric + hyphens/underscores)
- [ ] Output base64-encoded definition parts ready for API upload

**Tests:**
```python
# test_ontology_generator.py
import json
import base64

class TestOntologyDefinitionGenerator:
    
    def test_generate_entity_types_from_silver(self):
        """Entity types generated from silver_node_types."""
        definition = generate_ontology_definition()
        entity_parts = [p for p in definition["parts"] if "EntityTypes" in p["path"]]
        assert len(entity_parts) > 0
    
    def test_entity_type_has_required_fields(self):
        """Each entity type has id, name, namespace, properties."""
        definition = generate_ontology_definition()
        entity_part = next(p for p in definition["parts"] if "EntityTypes" in p["path"] and "definition.json" in p["path"])
        payload = json.loads(base64.b64decode(entity_part["payload"]))
        assert "id" in payload
        assert "name" in payload
        assert "namespace" in payload
    
    def test_property_datatype_mapping(self):
        """RDF datatypes map to Fabric Ontology types."""
        type_map = {
            "xsd:string": "String",
            "xsd:integer": "BigInt",
            "xsd:int": "BigInt",
            "xsd:long": "BigInt",
            "xsd:double": "Double",
            "xsd:boolean": "Boolean",
            "xsd:dateTime": "DateTime",
        }
        for rdf_type, fabric_type in type_map.items():
            result = map_to_ontology_datatype(rdf_type)
            assert result == fabric_type
    
    def test_valid_entity_names(self):
        """Entity names conform to Fabric naming rules."""
        definition = generate_ontology_definition()
        for part in definition["parts"]:
            if "EntityTypes" in part["path"] and "definition.json" in part["path"]:
                payload = json.loads(base64.b64decode(part["payload"]))
                name = payload["name"]
                assert 1 <= len(name) <= 26
                assert name[0].isalnum() and name[-1].isalnum()
```

**Dependencies:** F4.1, F4.2

---

### F5.2 - Fabric Ontology REST API Client
**Priority:** 🟠 P1 | **Status:** ✅ Complete | **Estimate:** M

**Description:** Client for Fabric Ontology REST API operations.

**API Operations:**
| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| Create Ontology | POST /v1/workspaces/{id}/ontologies | Create new Ontology item |
| Get Ontology | GET /v1/workspaces/{id}/ontologies/{ontologyId} | Get Ontology metadata |
| Get Definition | POST /ontologies/{id}/getDefinition | Retrieve current entity types, properties, relationships |
| Update Definition | POST /ontologies/{id}/updateDefinition | Push entity types, properties, bindings |
| List Ontologies | GET /v1/workspaces/{id}/ontologies | List all ontologies in workspace |

**Authentication:** Entra ID with scope `Item.ReadWrite.All`

**Acceptance Criteria:**
- [ ] Authenticate using Entra ID token (user or service principal)
- [ ] Create new Ontology item in workspace
- [ ] Retrieve existing Ontology definition
- [ ] Update Ontology definition (entity types, properties, relationships)
- [ ] Handle long-running operations (LRO) with polling
- [ ] Handle API errors gracefully
- [ ] Retry on transient failures (429, 5xx)

**Tests:**
```python
# test_fabric_ontology_client.py (integration tests - require Fabric connection)
import pytest

@pytest.mark.integration
class TestFabricOntologyClient:
    
    def test_create_ontology(self, fabric_client, workspace_id):
        result = fabric_client.create_ontology(
            workspace_id=workspace_id,
            display_name="TestOntology",
            description="Test ontology for integration tests"
        )
        assert result["id"] is not None
        assert result["type"] == "Ontology"
    
    def test_get_ontology_definition(self, fabric_client, ontology_id):
        definition = fabric_client.get_definition(ontology_id)
        assert "parts" in definition
    
    def test_update_ontology_definition(self, fabric_client, ontology_id, definition_parts):
        result = fabric_client.update_definition(ontology_id, definition_parts)
        assert result.status_code in [200, 202]  # May be async
    
    def test_handle_auth_error(self, fabric_client):
        fabric_client.token = "invalid"
        with pytest.raises(AuthenticationError):
            fabric_client.list_ontologies("any-workspace-id")
```

**Dependencies:** F5.1

---

### F5.3 - Lakehouse Data Binding
**Priority:** 🟠 P1 | **Status:** ✅ Complete | **Estimate:** M

**Description:** Generate data binding configuration to connect Ontology entity types to Lakehouse Delta tables.

**Binding Types:**
- **Static binding:** Entity properties bound to Lakehouse table columns (gold_nodes)
- **Relationship binding:** Relationship types bound to edge table (gold_edges)
- **Time series binding:** (Future) Real-time data from Eventhouse

**Data Binding JSON Structure:**
```json
{
  "id": "binding-uuid",
  "dataBindingConfiguration": {
    "dataBindingType": "NonTimeSeries",
    "propertyBindings": [
      {"sourceColumnName": "name", "propertyId": "prop-id-1"},
      {"sourceColumnName": "description", "propertyId": "prop-id-2"}
    ],
    "dataSource": {
      "workspaceId": "ws-id",
      "lakehouseId": "lh-id",
      "tableName": "gold_nodes"
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Generate static data binding JSON for entity types
- [ ] Map gold_nodes columns to entity type properties
- [ ] Generate relationship binding for gold_edges
- [ ] Set entity type key (unique identifier column)
- [ ] Set display name property for entity instances
- [ ] Validate binding columns exist in source tables
- [ ] Handle binding errors from API

**Limitations:**
- Lakehouse tables must be managed (not external)
- OneLake security must be disabled on lakehouse
- Column mapping must not be enabled on Delta tables
- Each entity type supports one static data binding

**Tests:**
```python
# test_data_binding.py
class TestLakehouseDataBinding:
    
    def test_generate_entity_binding(self):
        binding = generate_entity_binding(
            entity_type_id="entity-123",
            lakehouse_id="lh-id",
            table_name="gold_nodes",
            property_mappings=[
                {"column": "name", "property_id": "prop-1"},
                {"column": "description", "property_id": "prop-2"}
            ]
        )
        assert binding["dataBindingConfiguration"]["dataBindingType"] == "NonTimeSeries"
        assert len(binding["dataBindingConfiguration"]["propertyBindings"]) == 2
    
    def test_generate_relationship_binding(self):
        binding = generate_relationship_binding(
            relationship_type_id="rel-123",
            source_entity_key_column="source_id",
            target_entity_key_column="target_id",
            table_name="gold_edges"
        )
        assert "sourceEntityKeyColumn" in binding
        assert "targetEntityKeyColumn" in binding
    
    def test_validate_columns_exist(self):
        # Should raise if column doesn't exist in table
        with pytest.raises(ValidationError):
            validate_binding_columns(
                table="gold_nodes",
                columns=["nonexistent_column"]
            )
```

**Dependencies:** F4.4, F5.1

---

## Epic 6: SHACL Validation (Pre-Load)

### F6.1 - SHACL Shape Parser
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Parse SHACL shapes to understand validation constraints.

**Acceptance Criteria:**
- [ ] Parse sh:NodeShape definitions
- [ ] Parse sh:PropertyShape definitions
- [ ] Extract sh:path, sh:datatype, sh:minCount, sh:maxCount
- [ ] Extract sh:class, sh:nodeKind constraints
- [ ] List all shapes and their targets

**Tests:**
```python
# test_shacl_parser.py
class TestShaclParser:
    
    def test_parse_node_shapes(self):
        shapes = parse_shacl("normative_nen2660/nen2660-shacl.ttl")
        node_shapes = [s for s in shapes if s["type"] == "NodeShape"]
        assert len(node_shapes) > 0
    
    def test_parse_property_shapes(self):
        shapes = parse_shacl("normative_nen2660/nen2660-shacl.ttl")
        prop_shapes = [s for s in shapes if s["type"] == "PropertyShape"]
        assert len(prop_shapes) > 0
    
    def test_extract_constraints(self):
        shapes = parse_shacl("normative_nen2660/nen2660-shacl.ttl")
        # Should have various constraint types
        has_min_count = any(s.get("minCount") is not None for s in shapes)
        has_datatype = any(s.get("datatype") is not None for s in shapes)
        assert has_min_count or has_datatype
```

**Dependencies:** F2.1

---

### F6.2 - SHACL Validator
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** L

**Description:** Validate RDF data against SHACL shapes before loading.

**Acceptance Criteria:**
- [ ] Validate data graph against shapes graph
- [ ] Return conformance result (pass/fail)
- [ ] Return detailed violation report
- [ ] Support severity levels (Violation, Warning, Info)
- [ ] Option to continue on warnings

**Tests:**
```python
# test_shacl_validator.py
class TestShaclValidator:
    
    def test_valid_data_conforms(self):
        result = validate_shacl(
            data="test/valid_data.ttl",
            shapes="test/shapes.ttl"
        )
        assert result.conforms == True
    
    def test_invalid_data_fails(self):
        result = validate_shacl(
            data="test/invalid_data.ttl",
            shapes="test/shapes.ttl"
        )
        assert result.conforms == False
    
    def test_violation_report(self):
        result = validate_shacl(
            data="test/invalid_data.ttl",
            shapes="test/shapes.ttl"
        )
        assert len(result.violations) > 0
        for v in result.violations:
            assert "focusNode" in v
            assert "message" in v
    
    def test_severity_filtering(self):
        result = validate_shacl(
            data="test/warnings_only.ttl",
            shapes="test/shapes.ttl",
            severity_threshold="Violation"  # Ignore warnings
        )
        assert result.conforms == True
```

**Dependencies:** F6.1

---

### F6.3 - Constraint Extraction & Storage
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Extract and store constraints from SHACL/OWL for future enforcement via Fabric Ontology Rules, Fabric Activator, or Fabric Operational Agent.

> **Rationale:** RDF standards (SHACL, OWL) express rich constraints. Fabric Ontology doesn't support SHACL natively yet, but we should capture constraints as metadata now for future implementation when Fabric Ontology Rules becomes GA.

**Constraint Types to Extract:**

| Source | Constraint Type | Example | Future Enforcement |
|--------|----------------|---------|-------------------|
| SHACL | Cardinality | `sh:minCount 1` | Ontology Rules (when GA) |
| SHACL | Data type | `sh:datatype xsd:decimal` | Ontology Rules |
| SHACL | Pattern | `sh:pattern "^[A-Z]{3}$"` | Activator / Pipeline |
| SHACL | Value range | `sh:minInclusive 0` | Activator / Agent |
| OWL | Functional property | `owl:FunctionalProperty` | Ontology Rules |
| OWL | Symmetric/Inverse | `owl:inverseOf` | Ontology Rules |
| OWL | Disjoint classes | `owl:disjointWith` | Agent (validation) |
| RDFS | Domain/Range | `rdfs:domain`, `rdfs:range` | Already mapped |

**Output:** `silver_constraints` Delta table

| Column | Type | Description |
|--------|------|-------------|
| constraint_id | String | Unique identifier |
| source_uri | String | SHACL shape or OWL axiom URI |
| constraint_type | String | cardinality, datatype, pattern, etc. |
| target_entity | String | Node type or property affected |
| specification | JSON | Full constraint details |
| enforcement_target | String | ontology_rules, activator, agent, none |
| source_file | String | Origin file (e.g., nen2660-shacl.ttl) |

**Acceptance Criteria:**
- [ ] Parse SHACL shapes into silver_constraints
- [ ] Parse OWL axioms (functional, inverse, disjoint) into silver_constraints
- [ ] Classify each constraint by enforcement_target
- [ ] Generate summary report of constraints found
- [ ] Expose constraints in ontology definition JSON as metadata (not enforced)

**Tests:**
```python
# test_constraint_extraction.py
class TestConstraintExtraction:
    
    def test_extract_shacl_cardinality(self):
        constraints = extract_constraints("nen2660-shacl.ttl")
        cardinality = [c for c in constraints if c["constraint_type"] == "cardinality"]
        assert len(cardinality) > 0
        assert all("minCount" in c["specification"] or "maxCount" in c["specification"] 
                   for c in cardinality)
    
    def test_extract_owl_functional(self):
        constraints = extract_constraints("nen2660-owl.ttl")
        functional = [c for c in constraints if c["constraint_type"] == "functional"]
        # All functional properties should be captured
        assert len(functional) >= 0  # May be 0 in test data
    
    def test_enforcement_target_classification(self):
        constraints = extract_constraints("nen2660-shacl.ttl")
        # Each constraint should have valid enforcement target
        valid_targets = {"ontology_rules", "activator", "agent", "none"}
        assert all(c["enforcement_target"] in valid_targets for c in constraints)
```

**Dependencies:** F6.1

---

## Epic 12: Fabric Rules Integration (Phase 2)
> **Phase:** 2 (Post-MVP) | **Depends on:** Fabric Ontology Rules GA

### F12.1 - Ontology Rules Generator
**Priority:** 🟢 P3 | **Status:** ⬜ Not Started | **Estimate:** L

**Description:** Generate Fabric Ontology Rules from extracted constraints when the API becomes GA.

> **Note:** Fabric Ontology Rules is currently in private preview. This feature should wait until the API stabilizes.

**Mapping Strategy:**

| SHACL/OWL Constraint | Fabric Ontology Rule |
|---------------------|---------------------|
| `sh:minCount 1` | Required property |
| `sh:maxCount 1` | Single-valued property |
| `sh:datatype xsd:integer` | Property value type |
| `sh:class :SomeClass` | Relationship target type |
| `owl:FunctionalProperty` | Single-valued property |
| `owl:inverseOf` | Inverse relationship (if supported) |

**Acceptance Criteria:**
- [ ] Generate Ontology Rules JSON from silver_constraints
- [ ] Upload rules via Fabric Rules API (when available)
- [ ] Report unsupported constraints to user
- [ ] Validate rules before upload

**Dependencies:** F6.3, Fabric Ontology Rules GA

---

### F12.2 - Activator Policy Generator
**Priority:** 🟢 P3 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Generate Fabric Activator policies for runtime constraint enforcement.

**Use Cases:**
- Data validation on ingestion
- Pattern matching alerts
- Value range monitoring
- Periodic compliance checks

**Acceptance Criteria:**
- [ ] Generate Activator trigger definitions from constraints
- [ ] Support event-driven validation patterns
- [ ] Create alerting rules for constraint violations

**Dependencies:** F6.3

---

### F12.3 - Operational Agent Rules
**Priority:** 🟢 P3 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Generate Fabric Operational Agent rules for complex/cross-domain constraints.

**Use Cases:**
- Multi-entity validation rules
- Process/workflow constraints
- Time-based rules
- Cross-reference validations

**Acceptance Criteria:**
- [ ] Define agent action patterns from complex constraints
- [ ] Support remediation workflows
- [ ] Generate human-readable constraint descriptions for agent context

**Dependencies:** F6.3

---

## Epic 7: Frontend - React Application

### F7.1 - React App Scaffold
**Priority:** 🟠 P1 | **Status:** ✅ Complete | **Estimate:** M

**Description:** Create React application with Fluent UI and basic structure.

**Implementation Notes:**
- Location: `src/app/`
- Stack: Vite 5.1 + React 18 + TypeScript + Fluent UI v9 + Electron
- 20+ files including pages, components, state management, auth setup

**Acceptance Criteria:**
- [x] Vite + React + TypeScript setup
- [x] Fluent UI v9 components installed
- [x] Basic folder structure (components, hooks, services, pages)
- [x] Routing configured (React Router)
- [x] Development server runs (`npm run dev`)
- [x] Build produces static files (`npm run build`)

**Tests:**
```typescript
// test/App.test.tsx (Jest/Vitest)
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
  
  test('shows navigation', () => {
    render(<App />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
```

**Dependencies:** None

---

### F7.2 - Entra ID Authentication
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Implement Entra ID authentication for web and desktop.

**Acceptance Criteria:**
- [ ] MSAL.js configured with app registration
- [ ] Login/logout flow working
- [ ] Token acquisition for Fabric API
- [ ] Token refresh handling
- [ ] User info display (name, email)
- [ ] Cross-tenant authentication (multi-tenant app)
- [ ] Device code flow for Electron (desktop)

**Tests:**
```typescript
// test/auth.test.ts
import { AuthService } from '../src/services/auth';

describe('AuthService', () => {
  test('login initiates redirect', async () => {
    const auth = new AuthService();
    await auth.login();
    // Should redirect to Microsoft login
  });
  
  test('getToken returns valid token', async () => {
    const auth = new AuthService();
    auth.setMockUser({ name: 'Test User' });
    const token = await auth.getToken(['https://analysis.windows.net/powerbi/api/.default']);
    expect(token).toBeTruthy();
  });
  
  test('logout clears session', async () => {
    const auth = new AuthService();
    auth.setMockUser({ name: 'Test User' });
    await auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
  });
});
```

**Dependencies:** F7.1

---

### F7.3 - Workspace Configuration Page
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** S

**Description:** First-run setup page for workspace configuration.

**Acceptance Criteria:**
- [ ] Input for Fabric workspace URL
- [ ] Workspace validation (check connectivity)
- [ ] Save workspace config to local storage
- [ ] Load saved config on app start
- [ ] Change workspace option in settings

**Tests:**
```typescript
// test/WorkspaceConfig.test.tsx
describe('WorkspaceConfig', () => {
  test('shows input for workspace URL', () => {
    render(<WorkspaceConfig />);
    expect(screen.getByLabelText(/workspace url/i)).toBeInTheDocument();
  });
  
  test('validates workspace URL format', async () => {
    render(<WorkspaceConfig />);
    const input = screen.getByLabelText(/workspace url/i);
    await userEvent.type(input, 'invalid-url');
    expect(screen.getByText(/invalid url/i)).toBeInTheDocument();
  });
  
  test('saves valid workspace to storage', async () => {
    render(<WorkspaceConfig />);
    const input = screen.getByLabelText(/workspace url/i);
    await userEvent.type(input, 'https://app.fabric.microsoft.com/...');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(localStorage.getItem('workspaceUrl')).toBeTruthy();
  });
});
```

**Dependencies:** F7.1, F7.2

---

### F7.4 - Project Management
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Create, list, load, and save translation projects.

**Project Config Structure:**
```typescript
interface Project {
  id: string;
  name: string;
  created: string;
  updated: string;
  source: {
    files: string[];
    schemaFiles: string[];
  };
  schemaLevel: number;
  decisions: Record<string, DecisionValue>;
  status: 'draft' | 'configured' | 'translated' | 'loaded';
}
```

**Acceptance Criteria:**
- [ ] Create new project
- [ ] List existing projects
- [ ] Load project by ID
- [ ] Save project changes
- [ ] Delete project
- [ ] Store projects in lakehouse (Files/config/)

**Tests:**
```typescript
// test/ProjectService.test.ts
describe('ProjectService', () => {
  test('create new project', async () => {
    const project = await projectService.create({ name: 'Test Project' });
    expect(project.id).toBeTruthy();
    expect(project.status).toBe('draft');
  });
  
  test('list projects', async () => {
    await projectService.create({ name: 'Project 1' });
    await projectService.create({ name: 'Project 2' });
    const projects = await projectService.list();
    expect(projects.length).toBeGreaterThanOrEqual(2);
  });
  
  test('load project by id', async () => {
    const created = await projectService.create({ name: 'Test' });
    const loaded = await projectService.get(created.id);
    expect(loaded.name).toBe('Test');
  });
  
  test('save project updates', async () => {
    const project = await projectService.create({ name: 'Original' });
    project.name = 'Updated';
    await projectService.save(project);
    const loaded = await projectService.get(project.id);
    expect(loaded.name).toBe('Updated');
  });
});
```

**Dependencies:** F7.3

---

### F7.5 - File Browser & Upload
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Browse lakehouse files and upload new RDF files.

**Acceptance Criteria:**
- [ ] Browse lakehouse Files folder
- [ ] Filter by file extension (.ttl, .rdf, etc.)
- [ ] Multi-select files for project
- [ ] Upload local RDF files to lakehouse
- [ ] Show file size and modified date
- [ ] Preview first few lines of file

**Tests:**
```typescript
// test/FileBrowser.test.tsx
describe('FileBrowser', () => {
  test('lists files from lakehouse', async () => {
    render(<FileBrowser path="Files/" />);
    await waitFor(() => {
      expect(screen.getByText(/normative_nen2660/)).toBeInTheDocument();
    });
  });
  
  test('filters by extension', async () => {
    render(<FileBrowser path="Files/" filter=".ttl" />);
    await waitFor(() => {
      const files = screen.getAllByRole('listitem');
      files.forEach(f => {
        expect(f.textContent).toMatch(/\.ttl$/);
      });
    });
  });
  
  test('allows multi-select', async () => {
    render(<FileBrowser path="Files/" multiSelect />);
    await userEvent.click(screen.getByText('file1.ttl'));
    await userEvent.click(screen.getByText('file2.ttl'));
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
  });
});
```

**Dependencies:** F7.3

---

### F7.6 - Decision Dashboard
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** L

**Description:** Main UI showing all 12 B-category decisions.

**Acceptance Criteria:**
- [ ] Display all 12 decisions as cards
- [ ] Show decision status (auto-resolved, pending, completed)
- [ ] Show recommended next decision
- [ ] Click to expand decision details
- [ ] Select option for each decision
- [ ] Show dependencies between decisions
- [ ] Grey out irrelevant decisions

**Tests:**
```typescript
// test/DecisionDashboard.test.tsx
describe('DecisionDashboard', () => {
  test('shows all 12 decisions', () => {
    render(<DecisionDashboard project={mockProject} />);
    const cards = screen.getAllByTestId('decision-card');
    expect(cards.length).toBe(12);
  });
  
  test('highlights recommended decision', () => {
    render(<DecisionDashboard project={mockProject} />);
    expect(screen.getByText(/recommended/i)).toBeInTheDocument();
  });
  
  test('shows auto-resolved decisions', () => {
    const project = { ...mockProject, schemaLevel: 3 };
    render(<DecisionDashboard project={project} />);
    expect(screen.getAllByText(/auto-resolved/i).length).toBeGreaterThan(0);
  });
  
  test('expands decision on click', async () => {
    render(<DecisionDashboard project={mockProject} />);
    await userEvent.click(screen.getByText('B1: Node Type Mapping'));
    expect(screen.getByText(/choose how to map/i)).toBeInTheDocument();
  });
});
```

**Dependencies:** F7.4

---

### F7.7 - Graph Preview (React Flow)
**Priority:** 🟠 P1 | **Status:** ⬜ Not Started | **Estimate:** L

**Description:** Interactive graph visualization using React Flow.

**Acceptance Criteria:**
- [ ] Display sample nodes and edges
- [ ] Color-code by node type
- [ ] Show node properties on hover
- [ ] Pan and zoom
- [ ] Limit preview to N nodes (configurable)
- [ ] Generate preview from schema mapping

**Tests:**
```typescript
// test/GraphPreview.test.tsx
describe('GraphPreview', () => {
  test('renders nodes', () => {
    const data = {
      nodes: [{ id: 'n1', label: 'Person', properties: { name: 'John' } }],
      edges: []
    };
    render(<GraphPreview data={data} />);
    expect(screen.getByText('Person')).toBeInTheDocument();
  });
  
  test('renders edges between nodes', () => {
    const data = {
      nodes: [
        { id: 'n1', label: 'Person' },
        { id: 'n2', label: 'Person' }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', label: 'KNOWS' }
      ]
    };
    render(<GraphPreview data={data} />);
    expect(screen.getByText('KNOWS')).toBeInTheDocument();
  });
  
  test('shows properties on hover', async () => {
    const data = {
      nodes: [{ id: 'n1', label: 'Person', properties: { name: 'John' } }],
      edges: []
    };
    render(<GraphPreview data={data} />);
    await userEvent.hover(screen.getByText('Person'));
    expect(screen.getByText('name: John')).toBeInTheDocument();
  });
});
```

**Dependencies:** F7.1

---

### F7.8 - Translation Execution UI
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** UI to trigger translation and monitor progress.

**Acceptance Criteria:**
- [ ] Start translation button
- [ ] Progress indicator (steps completed)
- [ ] Real-time log output
- [ ] Success/failure indication
- [ ] Link to Fabric Graph after success
- [ ] Retry on failure

**Tests:**
```typescript
// test/TranslationExecution.test.tsx
describe('TranslationExecution', () => {
  test('shows start button', () => {
    render(<TranslationExecution project={mockProject} />);
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });
  
  test('shows progress during execution', async () => {
    render(<TranslationExecution project={mockProject} />);
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
  
  test('shows success message', async () => {
    mockTranslationSuccess();
    render(<TranslationExecution project={mockProject} />);
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });
});
```

**Dependencies:** F7.6

---

### F7.9 - Label Override & Language Management UI
**Priority:** 🟢 P3 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** UI to review and override display names when preferred language labels are missing. Related to R14 (Label Language Fallback).

---

### F7.10 - Property Domain Override UI
**Priority:** 🟢 P3 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** UI to assign or override rdfs:domain for properties that lack domain declarations in the source ontology. Related to R15 (Missing domain/range).

**Context:** Many ontologies define properties without `rdfs:domain` declarations (e.g., `designLifespan`, `length`, `width`). These properties are skipped during edge creation because we cannot determine which node type(s) they belong to. This UI allows users to:
1. See which properties were skipped due to missing domain
2. Assign domain(s) to orphaned properties
3. Export/import domain override mappings

**Acceptance Criteria:**
- [ ] List properties without rdfs:domain declarations
- [ ] Show property URI, label, and target type (if any)
- [ ] Allow assigning one or more source node types
- [ ] Save overrides to project configuration
- [ ] Apply overrides during next translation run
- [ ] Export domain overrides as JSON/CSV
- [ ] Import domain overrides from file

**Tests:**
```typescript
// test/PropertyDomainOverride.test.tsx
describe('PropertyDomainOverrideManager', () => {
  test('shows properties without domain', () => {
    render(<PropertyDomainOverrideManager project={mockProjectWithOrphanedProps} />);
    expect(screen.getByText('designLifespan')).toBeInTheDocument();
    expect(screen.getByText('No source type')).toBeInTheDocument();
  });
  
  test('allows assigning domain to property', async () => {
    render(<PropertyDomainOverrideManager project={mockProjectWithOrphanedProps} />);
    await userEvent.click(screen.getByRole('button', { name: /assign domain/i }));
    await userEvent.click(screen.getByText('PhysicalObject'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockSaveDomainOverride).toHaveBeenCalledWith('designLifespan', ['PhysicalObject']);
  });
});
```

**Dependencies:** F7.4

**Context:** When RDF sources lack labels in the preferred language (e.g., English), the system falls back to available labels (e.g., Dutch). This UI allows users to:
1. See which entities/properties are using fallback labels
2. Provide manual translations/overrides
3. Export/import label override mappings

**Acceptance Criteria:**
- [ ] List entities/properties with non-preferred language labels
- [ ] Show original label, language tag, and source URI
- [ ] Inline edit to provide preferred language override
- [ ] Save overrides to project configuration
- [ ] Apply overrides during next translation run
- [ ] Export label overrides as JSON/CSV
- [ ] Import label overrides from file

**Tests:**
```typescript
// test/LabelOverride.test.tsx
describe('LabelOverrideManager', () => {
  test('shows entities with fallback labels', () => {
    render(<LabelOverrideManager project={mockProjectWithFallbacks} />);
    expect(screen.getByText('hechtingskracht')).toBeInTheDocument();
    expect(screen.getByText('nl')).toBeInTheDocument(); // language tag
  });
  
  test('allows inline edit of display name', async () => {
    render(<LabelOverrideManager project={mockProjectWithFallbacks} />);
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.type(screen.getByRole('textbox'), 'adhesion strength');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockSaveOverride).toHaveBeenCalledWith('hechtingskracht', 'adhesion strength');
  });
});
```

**Dependencies:** F7.4

---

## Epic 8: Electron Desktop App

### F8.1 - Electron Wrapper
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Wrap React app in Electron for desktop distribution.

**Acceptance Criteria:**
- [ ] Electron main process configured
- [ ] Load React app in BrowserWindow
- [ ] Window title and icon
- [ ] Menu bar (File, Edit, Help)
- [ ] Device code auth flow
- [ ] Build for Windows (.exe)
- [ ] Build for macOS (.dmg)
- [ ] Build for Linux (.AppImage)

**Tests:**
```typescript
// test/electron.test.ts (Playwright/Spectron)
describe('Electron App', () => {
  test('opens main window', async () => {
    const app = await startElectronApp();
    const window = await app.firstWindow();
    expect(await window.title()).toBe('RDF2Fabric');
  });
  
  test('shows login on first launch', async () => {
    const app = await startElectronApp();
    const window = await app.firstWindow();
    expect(await window.locator('text=Sign in').isVisible()).toBe(true);
  });
});
```

**Dependencies:** F7.1, F7.2

---

## Epic 9: Pipeline Orchestration

### F9.1 - Translation Pipeline
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** Fabric Data Pipeline for end-to-end translation.

**Pipeline Steps:**
1. Read project config from lakehouse
2. Run schema detection notebook
3. Run translation notebook
4. Run graph loader notebook
5. Update project status

**Acceptance Criteria:**
- [ ] Pipeline defined in Fabric
- [ ] Accepts project ID as parameter
- [ ] Runs notebooks in sequence
- [ ] Passes data between steps
- [ ] Handles errors gracefully
- [ ] Updates project status on completion

**Tests:**
```python
# test_pipeline.py (integration)
@pytest.mark.integration
class TestTranslationPipeline:
    
    def test_pipeline_runs_successfully(self, fabric_client, test_project):
        result = fabric_client.run_pipeline(
            "pl_full_translation",
            parameters={"projectId": test_project.id}
        )
        assert result.status == "Succeeded"
    
    def test_pipeline_updates_project_status(self, fabric_client, test_project):
        fabric_client.run_pipeline(
            "pl_full_translation",
            parameters={"projectId": test_project.id}
        )
        project = load_project(test_project.id)
        assert project.status == "loaded"
```

**Dependencies:** F2.1, F3.1, F4.4, F5.2

---

### F9.2 - Preview Pipeline
**Priority:** 🟡 P2 | **Status:** ⬜ Not Started | **Estimate:** S

**Description:** Lightweight pipeline for generating preview without full load.

**Pipeline Steps:**
1. Read project config
2. Parse sample of RDF data
3. Generate preview nodes/edges
4. Write to preview tables

**Acceptance Criteria:**
- [ ] Limited to first N triples
- [ ] Fast execution (< 30 sec)
- [ ] Preview tables don't affect production
- [ ] Called from app for preview display

**Tests:**
```python
# test_preview_pipeline.py
class TestPreviewPipeline:
    
    def test_preview_is_limited(self, fabric_client, test_project):
        result = fabric_client.run_pipeline(
            "pl_preview_only",
            parameters={"projectId": test_project.id, "limit": 100}
        )
        preview = spark.read.format("delta").load("Tables/preview_nodes")
        assert preview.count() <= 100
    
    def test_preview_is_fast(self, fabric_client, test_project):
        import time
        start = time.time()
        fabric_client.run_pipeline(
            "pl_preview_only",
            parameters={"projectId": test_project.id}
        )
        duration = time.time() - start
        assert duration < 30
```

**Dependencies:** F9.1

---

## Epic 10: Documentation & Deployment

### F10.1 - User Documentation
**Priority:** 🟢 P3 | **Status:** ⬜ Not Started | **Estimate:** M

**Description:** End-user documentation for installing and using RDF2Fabric.

**Acceptance Criteria:**
- [ ] Installation guide (Web, Desktop)
- [ ] Getting started tutorial
- [ ] Decision reference guide (all 12 decisions explained)
- [ ] Troubleshooting FAQ
- [ ] Example walkthroughs

**Tests:** Manual review, spell check.

---

### F10.2 - GitHub Releases
**Priority:** 🟢 P3 | **Status:** ⬜ Not Started | **Estimate:** S

**Description:** Automated release builds for desktop installers.

**Acceptance Criteria:**
- [ ] GitHub Action for release builds
- [ ] Builds Windows .exe installer
- [ ] Builds macOS .dmg
- [ ] Builds Linux .AppImage
- [ ] Attaches artifacts to GitHub Release
- [ ] Triggered on tag push (v*)

**Tests:** Manual verification of release artifacts.

---

## Implementation Order (Suggested)

### Phase 1: Foundation (Week 1-2)
1. ✅ F1.2 - Lakehouse Setup
2. ✅ F1.3 - Test Data Validation
3. ✅ F2.1 - Basic RDF Parser (Turtle)
4. F3.1 - Schema Detector

### Phase 2: Core Translation (Week 3-4)
5. F4.1 - Class to Node Type Mapping
6. F4.2 - Property Mapping
7. F4.3 - Instance Translation
8. F4.4 - Delta Writer
9. F5.1 - Graph Model Generator

### Phase 3: Frontend (Week 5-6)
10. ✅ F7.1 - React Scaffold
11. F7.2 - Authentication
12. F7.3 - Workspace Config
13. F7.4 - Project Management
14. F7.5 - File Browser

### Phase 4: Integration (Week 7-8)
15. F5.2 - Fabric Graph API Client
16. F5.3 - Data Binding
17. F7.6 - Decision Dashboard
18. F7.7 - Graph Preview

### Phase 5: Polish (Week 9-10)
19. F2.2 - Multi-Format Parser
20. F6.1 - SHACL Parser
21. F6.2 - SHACL Validator
22. F7.8 - Execution UI
23. F8.1 - Electron Wrapper

### Phase 6: Production (Week 11-12)
24. F9.1 - Translation Pipeline
25. F9.2 - Preview Pipeline
26. F10.1 - User Documentation
27. F10.2 - GitHub Releases

---

## Test Infrastructure

### Unit Tests
- **Python:** pytest + pytest-spark
- **Scala:** ScalaTest
- **TypeScript:** Vitest + React Testing Library

### Integration Tests
- Require Fabric connection
- Mark with `@pytest.mark.integration`
- Run in CI against dev workspace

### E2E Tests
- Playwright for web app
- Spectron/Playwright for Electron
- Full flow with NEN 2660 test data

### Test Data
- Located in `ws-ont_nen2660-dev-01/lh_nen2660data_dev_01`
- Synthetic test files in `tests/fixtures/`

---

## Notes

- Features can be worked on in parallel where dependencies allow
- Each feature should have a PR with tests passing
- Tag releases after completing each phase
- Update this backlog as requirements evolve
