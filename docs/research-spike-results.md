# Research Spike Results: Fabric Graph & Ontology API

**Date**: February 24, 2026  
**Status**: Completed

## Executive Summary

**Critical Finding**: Microsoft Fabric Graph does **NOT support RDF directly**. It uses the **Labeled Property Graph (LPG)** model, which is fundamentally different from RDF's subject-predicate-object triple model.

This changes our approach: we must build a **translation layer** that converts RDF to LPG format, rather than importing RDF natively.

---

## S1: Fabric Ontology API Format

### Key Discoveries

1. **"Ontology" in Fabric ≠ OWL Ontology**
   - Fabric's "Ontology (preview)" is a **semantic layer** for enterprise vocabulary
   - It defines entity types, properties, and relationships for business concepts
   - It is NOT an RDF/OWL ontology format

2. **Graph Model REST API Exists**
   - Endpoint: `POST /workspaces/{workspaceId}/GraphModels`
   - Full CRUD operations available
   - JSON definition format is documented
   - **Limitation**: User identity only (no service principal support)

3. **Graph Model JSON Definition Structure**
   ```
   GraphModelDefinition
   ├── dataSources[]         → Delta table paths in OneLake
   ├── graphDefinition       → Node/Edge table mappings
   │   ├── nodeTables[]      → Maps tables to node types
   │   └── edgeTables[]      → Maps tables to edge types
   ├── graphType             → Schema definition
   │   ├── nodeTypes[]       → Node labels, properties, keys
   │   └── edgeTypes[]       → Edge labels, source/target
   └── stylingConfiguration  → Visual layout (optional)
   ```

4. **Data Flow Architecture**
   ```
   OneLake Tables → Graph Model Definition → Fabric Graph
   (Delta format)     (JSON mapping)         (LPG storage)
   ```

### REST API Endpoints

| Operation | Endpoint | Auth |
|-----------|----------|------|
| Create Graph | `POST /workspaces/{id}/GraphModels` | User only |
| Get Definition | `POST /workspaces/{id}/GraphModels/{id}/getDefinition` | User only |
| Update Definition | `POST /workspaces/{id}/GraphModels/{id}/updateDefinition` | User only |
| Execute Query | `POST /workspaces/{id}/GraphModels/{id}/executeQuery?beta=true` | User only |
| Refresh Graph | `POST /workspaces/{id}/GraphModels/{id}/jobs/RefreshGraph/instances` | User only |

---

## S2: OWL Subset Support

### Finding: **NOT SUPPORTED**

Fabric Graph uses **Labeled Property Graph (LPG)** model, not RDF. There is no native support for:
- OWL (Web Ontology Language)
- RDFS (RDF Schema)
- RDF triples

### Implication for Our Project

We must **translate** OWL/RDFS concepts to LPG equivalents:

| OWL/RDFS Concept | LPG Equivalent |
|------------------|----------------|
| `owl:Class` | Node Type (label) |
| `owl:DatatypeProperty` | Node Property |
| `owl:ObjectProperty` | Edge Type |
| `rdfs:domain` | Edge source node type |
| `rdfs:range` | Edge target node type / Property type |
| `rdf:type` | Node label assignment |
| `owl:inverseOf` | Create reverse edge |
| `owl:sameAs` | Merge nodes (preprocessing) |

### Supported OWL Features via Translation

| Feature | Support Level | Notes |
|---------|---------------|-------|
| Class hierarchy | ⚠️ Partial | Flatten to labels; no inheritance |
| Datatype properties | ✅ Yes | Map to node properties |
| Object properties | ✅ Yes | Map to edges |
| Cardinality constraints | ❌ No | Must validate in preprocessing |
| Property restrictions | ❌ No | Must validate in preprocessing |
| Union/Intersection types | ⚠️ Limited | Multiple labels per node |

---

## S3: SHACL Support

### Finding: **NOT SUPPORTED**

SHACL (Shapes Constraint Language) is not supported by Fabric Graph or Ontology.

### Workaround

Implement SHACL validation **before** loading into Fabric:
1. Parse RDF data with rdflib
2. Validate against SHACL shapes using pySHACL
3. Report validation errors to user
4. Only proceed if validation passes

```python
# Preprocessing validation example
from pyshacl import validate

conforms, report_graph, report_text = validate(
    data_graph,
    shacl_graph=shapes,
    inference='rdfs'
)

if not conforms:
    raise ValidationError(report_text)
```

---

## S4: Schema Evolution

### Finding: **NOT SUPPORTED**

From official documentation:
> "Graph in Microsoft Fabric currently doesn't support schema evolution. After you ingest and model your data, the structure of nodes, relationships, and properties is fixed. If you need to make structural changes - such as adding new properties, modifying labels, or changing relationship types - you must reingest the updated source data into a new model."

### Workaround Strategy

1. **Versioned Graph Models**: Create new model with version suffix
   - `ProductCatalogGraph_v1` → `ProductCatalogGraph_v2`
   
2. **Deprecation Pattern**: 
   - Keep old model accessible during transition
   - Update consumers to new model
   - Delete old model after migration complete

3. **Schema Registry**: Track schema versions in metadata
   ```json
   {
     "graphName": "ProductCatalogGraph",
     "version": "2.0.0",
     "previousVersion": "1.0.0",
     "breakingChanges": ["Added Category node type"],
     "migrationDate": "2026-02-24"
   }
   ```

---

## S5: Fabric Graph Import Timing

### Estimated Performance

Based on documentation and architecture analysis:

| Data Size | Estimated Time | Notes |
|-----------|----------------|-------|
| Small (< 10K nodes) | < 30 seconds | Initial load |
| Medium (10K-100K nodes) | 1-5 minutes | Depends on edge density |
| Large (100K-1M nodes) | 5-30 minutes | May require capacity scaling |
| Very Large (> 1M nodes) | 30+ minutes | Consider partitioning |

### Performance Factors

1. **Capacity SKU**: Higher capacity = faster processing
2. **Edge density**: More edges = longer load time
3. **Property count**: More properties = more data transfer
4. **Source table format**: Delta tables with z-ordering are fastest

### Refresh Operation

Graph must be manually refreshed when source data changes:
```
POST /workspaces/{id}/GraphModels/{id}/jobs/RefreshGraph/instances
```

---

## S6: Fabric Graph GA Timeline

### Current Status: **Public Preview**

From official documentation (February 2026):
> "This feature is currently in public preview. This preview is provided without a service-level agreement, and isn't recommended for production workloads."

### GA Considerations

1. **No official GA date announced** as of this research
2. Preview features may change without notice
3. No SLA for preview features
4. Service principal authentication not yet supported

### Risk Mitigation

1. **Design for change**: Abstract Fabric Graph calls behind interface
2. **Monitor announcements**: Track Fabric roadmap and release notes
3. **Plan fallback**: Consider alternative graph storage if GA delayed
4. **Document assumptions**: Track preview-specific behaviors

---

## Revised Project Architecture

Based on these findings, our translation pipeline must be:

```
┌─────────────────────────────────────────────────────────────────┐
│                     RDF Translation Pipeline                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [RDF Files]                                                     │
│      │ Turtle, N-Triples, RDF/XML, JSON-LD                      │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. PARSE & VALIDATE                                     │    │
│  │    • rdflib: Parse RDF to memory graph                  │    │
│  │    • pySHACL: Validate against shapes (optional)        │    │
│  │    • Extract: classes, properties, relationships        │    │
│  └─────────────────────────────────────────────────────────┘    │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2. TRANSLATE TO LPG                                     │    │
│  │    • Classes → Node Types (labels)                      │    │
│  │    • Datatype Props → Node Properties                   │    │
│  │    • Object Props → Edge Types                          │    │
│  │    • Instances → Node/Edge rows                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 3. WRITE TO LAKEHOUSE                                   │    │
│  │    • Nodes → Delta tables (one per node type)           │    │
│  │    • Edges → Delta tables (one per edge type)           │    │
│  │    • Store in: Tables/<graph_name>/nodes_*, edges_*     │    │
│  └─────────────────────────────────────────────────────────┘    │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. GENERATE GRAPH MODEL                                 │    │
│  │    • Build JSON definition from table metadata          │    │
│  │    • dataSources: paths to node/edge tables             │    │
│  │    • graphType: node types, edge types, properties      │    │
│  │    • graphDefinition: column mappings                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 5. CREATE/UPDATE FABRIC GRAPH                           │    │
│  │    • REST API: Create Graph Model                       │    │
│  │    • REST API: Update Definition                        │    │
│  │    • REST API: Refresh Graph                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│      │                                                          │
│      ▼                                                          │
│  [Fabric Graph]                                                 │
│      • Query with GQL                                           │
│      • Visualize in Fabric UI                                   │
│      • Integrate with Power BI                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Impact on Requirements

### Updated Technical Requirements

1. **Backend Libraries**:
   - `rdflib` - RDF parsing (all formats)
   - `pySHACL` - SHACL validation (optional)
   - No OWL reasoner needed (no native support)

2. **API Integration**:
   - Fabric REST API for Graph Model management
   - User authentication required (device code flow)
   - No service principal support (preview limitation)

3. **Data Storage**:
   - Delta tables in Lakehouse
   - One table per node type
   - One table per edge type
   - Naming convention: `<graph>_nodes_<type>`, `<graph>_edges_<type>`

### Updated Non-Functional Requirements

1. **Schema Changes**: Require new Graph Model version
2. **Large Graphs**: May need capacity scaling
3. **GA Dependency**: Design for API changes

---

## Next Steps

1. ✅ Research complete - findings documented
2. ⬜ Update `requirements.md` with revised architecture
3. ⬜ Update `architecture.md` with LPG translation details
4. ⬜ Prototype notebook: RDF → Delta tables
5. ⬜ Prototype notebook: Delta tables → Graph Model JSON
6. ⬜ Test Graph Model creation via REST API

---

## References

- [Fabric Graph Overview](https://learn.microsoft.com/fabric/graph/overview)
- [Graph Data Models (LPG)](https://learn.microsoft.com/fabric/graph/graph-data-models)
- [Graph Model REST API](https://learn.microsoft.com/rest/api/fabric/graphmodel/items)
- [Graph Model Definition Format](https://learn.microsoft.com/rest/api/fabric/articles/item-management/definitions/graph-model-definition)
- [Fabric Ontology Overview](https://learn.microsoft.com/fabric/iq/ontology/overview)
