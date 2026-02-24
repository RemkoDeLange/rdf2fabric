# Requirements - Fabric RDF Translation

## Document Info
| Property | Value |
|----------|-------|
| Last Updated | 2026-02-23 |
| Status | Draft |
| Owner | <!-- Add owner --> |

---

## 1. Business Requirements

### 1.1 Business Problem

**RDF data cannot be directly imported into Microsoft Fabric Ontology and Fabric Graph.**

The challenge is fundamental: RDF (Resource Description Framework) from the Semantic Web uses a different graph paradigm than Fabric Graph, which is a Labeled Property Graph (LPG).

| Aspect | RDF / Semantic Graph | LPG / Fabric Graph |
|--------|---------------------|-------------------|
| **Philosophy** | Open World Assumption | Closed World Assumption |
| **Inference** | Supports reasoning (RDFS, OWL) | Everything must be explicit |
| **Identity** | URIs, allows blank nodes | Requires explicit node IDs |
| **Schema** | Optional, can be inferred | Ontology defines structure |
| **Multi-values** | Native support | Requires explicit modeling |
| **Named graphs** | Supported (provenance, context) | Not a native concept |

**The translation from RDF → LPG is not 1:1.** It requires human decisions about how to model concepts, which information to materialize, and what to lose in translation.

### 1.2 Business Objectives

- [x] **Generic Tool**: Build a reusable application (not a one-time ETL) that can translate *any* RDF dataset to Fabric Graph
- [ ] **Decision Support**: Guide users through the modeling decisions required for RDF → LPG translation
- [ ] **Automated Import**: Once decisions are made, automatically transform and load data into Fabric Ontology/Graph
- [ ] **Documentation**: Capture decisions and known limitations for each translation project

### 1.3 Success Criteria

| Criteria | Measure |
|----------|---------|
| Can parse multiple RDF formats | Turtle, TriG, JSON-LD, RDF/XML supported |
| Supports schema files | RDFS, OWL, SKOS, SHACL can inform translation |
| Interactive decision-making | User can make/review all translation decisions via UI |
| Automated pipeline | After decisions, import runs without manual intervention |
| Test dataset loads successfully | NEN 2660-2 examples import into Fabric Graph |

### 1.4 Stakeholders

| Role | Responsibilities |
|------|------------------|
| Knowledge Graph Specialist | Make translation/modeling decisions |
| Business Analyst | Support decisions with domain context |
| Data Engineer | Implement and maintain pipelines |

---

## 2. Functional Requirements

### 2.1 Input Sources

The application must handle two categories of RDF files:

**Normative Files (Schema/Model Definition)**
| Format | Purpose |
|--------|---------|
| RDFS | Class and property definitions |
| OWL | Ontology with richer semantics |
| SKOS | Concept schemes, taxonomies |
| SHACL | Shape constraints, validation rules |

**Informative Files (Instance Data)**
| Format | Extension | Notes |
|--------|-----------|-------|
| Turtle | `.ttl` | Most common, human-readable |
| TriG | `.trig` | Turtle + named graphs |
| JSON-LD | `.jsonld` | JSON-based, web-friendly |
| RDF/XML | `.rdf`, `.xml` | Original XML format |
| N-Triples | `.nt` | Line-based, simple |
| N-Quads | `.nq` | N-Triples + named graphs |

### 2.2 Translation Decision Framework

Translation from RDF → LPG requires handling three categories of differences:

#### Category A: Auto-Resolvable (Deterministic Transformations)

These can be handled automatically by the application without human intervention:

| ID | Item | RDF Concept | LPG Translation | Notes |
|----|------|-------------|-----------------|-------|
| A1 | **Triple → Node/Edge** | s-p-o triple | Node(s) + Edge(p) + Node/Property(o) | Core structural mapping |
| A2 | **IRI Normalization** | Full IRIs | Compact labels/local names | Systematic prefix stripping |
| A3 | **Literal Datatypes** | `"42"^^xsd:int` | Native int/string/bool | Type conversion rules |
| A4 | **Blank Nodes** | `_:b0` | Generated UUIDs | Deterministic ID generation |
| A5 | **Simple Reification** | Single statement about statement | Edge with properties | Standard pattern |
| A6 | **RDFS Hierarchy** | `rdfs:subClassOf` | Label inheritance/tags | Automatic flattening |
| A7 | **Multi-edges** | Duplicate triples | Multiple edges allowed | LPG multigraph support |

#### Category B: Human Decision Required (Ambiguous - Multiple Valid Options)

The application must guide users through these decisions with sufficient context:

| ID | Decision | Options | Guidance to Provide |
|----|----------|---------|---------------------|
| B1 | **Class Membership Encoding** | • Node label<br>• Property `type`<br>• Type-node + edge | Explain: Labels are query-optimized; properties allow multiple types; type-nodes enable type hierarchies |
| B2 | **RDF Containers/Collections** | • Array property<br>• Linked list nodes<br>• Indexed edges | Show examples of each; arrays are simpler but lose order semantics |
| B3 | **OWL/SHACL Constraints** | • Encode as schema<br>• Store as metadata<br>• Ignore at runtime | Fabric Ontology can capture some; full OWL cannot be enforced |
| B4 | **Named Graphs** | • Separate subgraphs<br>• Tags on edges<br>• Property `graph` | Important for provenance; show data volume implications |
| B5 | **Namespace Strategy** | • Prefix convention<br>• Full name property<br>• Tagging system | Show examples: `schema:Person` vs `Person` vs tag `schema` |
| B6 | **Inference Materialization** | • Precompute all<br>• Selected predicates only<br>• None (asserted only)<br>• Store with provenance | Critical: Explain storage cost vs query simplicity trade-off |
| B7 | **Complex N-ary Patterns** | • Event/measurement node<br>• Edge properties<br>• Intermediate nodes | Show common patterns (observations, qualified relations) |
| B8 | **Fabric Ontology Mapping** | • Full schema encoding<br>• Core entities only<br>• Metadata documentation | Depends on Fabric Ontology capabilities at time of use |
| B9 | **Multi-valued Properties** | • Array property<br>• Multiple edges<br>• First value only | RDF naturally supports; LPG arrays may have query limitations |
| B10 | **Language Tags** | • Separate properties per lang<br>• Nested object<br>• Ignore | Show: `label_en`, `label_nl` vs `label: {en: "...", nl: "..."}` |
| B11 | **Inverse Properties** | • Keep both directions<br>• One direction + query<br>• Materialize missing | Storage vs query trade-off |
| B12 | **SKOS Concepts** | • Hierarchical edges<br>• Flattened labels<br>• Tree structure | Common for taxonomies; show visualization implications |

**Requirement: For each B-category decision, the application MUST provide:**
1. Clear explanation of the trade-offs
2. Visual example of each option
3. Recommendation based on common use cases
4. Ability to preview impact before committing

#### Category C: Not Resolvable (Fundamental Semantic Gaps)

These differences CANNOT be resolved through translation. The application must clearly document these limitations:

| ID | Limitation | Explanation | User Documentation |
|----|------------|-------------|-------------------|
| C1 | **Open vs Closed World** | RDF: unknown ≠ false<br>LPG: closed world assumption | Must document assumption change; queries behave differently |
| C2 | **Identity Semantics** | RDF: IRIs have global meaning<br>LPG: node identity is local/arbitrary | URI-based linking may break |
| C3 | **Full OWL Semantics** | Class axioms, logical constraints, restrictions | Cannot be expressed or enforced in LPG |
| C4 | **RDFS/OWL Inference** | Class subsumption, property inheritance, domain/range | LPG cannot replicate dynamic reasoning |
| C5 | **Canonical Graph Equivalence** | RDF has formal graph isomorphism | LPG has no canonical forms |
| C6 | **Blank Node Semantics** | RDF blank nodes = existential variables | Cannot reproduce existential semantics |
| C7 | **Advanced Reification** | RDF statements as first-class objects | LPG edges cannot be addressed as nodes |
| C8 | **Description Logic** | RDF/OWL grounded in model theory | LPG has no formal semantic foundation |

**Requirement: The application MUST generate a "Translation Limitations Report" documenting:**
1. Which C-category items apply to the source data
2. Specific examples from the data affected
3. Recommendations for downstream consumers

### 2.3 Known Limitations

**These aspects of RDF CANNOT be fully preserved in LPG translation:**

| Limitation | Explanation | Mitigation |
|------------|-------------|------------|
| **Open World → Closed World** | RDF assumes unknown ≠ false; LPG assumes closed world | Document assumption change |
| **Dynamic Inference Lost** | Materialized inferences won't update when data changes | Re-run materialization on updates |
| **OWL Axioms Not Enforced** | Disjointness, cardinality restrictions, equivalence cannot be enforced | Document as metadata only |
| **Named Graph Semantics** | Full provenance/versioning semantics cannot be replicated | Partial support via properties |
| **Blank Node Merging** | Cannot merge data from multiple sources on blank nodes | Generate stable IDs |
| **SPARQL Incompatibility** | Existing SPARQL queries will not work | Must rewrite as Gremlin/Cypher |
| **Semantic Entailment** | RDFS/OWL entailment rules not automatically applied | Manual or pre-processing |

### 2.4 Outputs

| Output | Target | Format |
|--------|--------|--------|
| Ontology Definition | Fabric Ontology | Fabric Ontology format |
| Node Data | Fabric Lakehouse | Delta tables (CSV/Parquet intermediate) |
| Edge Data | Fabric Lakehouse | Delta tables (CSV/Parquet intermediate) |
| Decision Log | Documentation | Markdown / JSON |
| Loaded Graph | Fabric Graph | Via Ontology import |

---

## 3. Non-Functional Requirements

### 3.1 Performance
- Expected data volume: Variable (test set: 4 TTL example files)
- Processing time requirements: TBD based on data size
- Query response time: N/A (batch processing)

### 3.2 Security & Compliance
- Data classification: Depends on source data
- Access control requirements: Fabric workspace security
- Compliance requirements: TBD

### 3.3 Availability
- Uptime requirements: N/A (tool, not service)
- Disaster recovery: Git-based, Fabric workspace backup

---

## 4. Technical Requirements

### 4.1 Fabric Workloads Needed
- [x] Lakehouse - Store intermediate and final data (Delta tables)
- [x] Notebooks - RDF parsing, transformation logic (Spark)
- [x] Data Pipelines - Orchestrate the translation workflow
- [ ] Data Warehouse - Not needed
- [ ] Real-Time Intelligence - Not needed
- [x] Power BI Reports / Fabric App - Visual interface for decision-making
- [x] Fabric Ontology - Target ontology definition
- [x] Fabric Graph - Target graph database

### 4.2 Fabric Graph Data Requirements (from documentation)

**Critical findings from Microsoft documentation:**

| Requirement | Detail |
|-------------|--------|
| **Data Source** | Lakehouse tables (managed tables in OneLake) |
| **Table Format** | Delta Lake tables (Parquet-based) |
| **NOT Supported** | External tables, tables with OneLake security enabled |
| **NOT Supported** | Lakehouse schema (preview) enabled |
| **Column Names** | Avoid special characters: `,` `;` `{}` `()` `\n` `\t` `=` and spaces |
| **Column Mapping** | Delta tables with column mapping enabled are NOT supported |

**Graph Model Structure:**
| Element | Maps To | Required Columns |
|---------|---------|------------------|
| **Node Type** | Lakehouse table | ID column (key), property columns |
| **Edge Type** | Lakehouse table | Source node key column, Target node key column |
| **Properties** | Table columns | Any additional columns become properties |

**Data Binding (Ontology → Lakehouse):**
- Static data binding: One table per entity type
- Time series binding: Can combine multiple sources
- Source data must be in **managed** lakehouse tables
- Manual refresh required after source data updates

### 4.3 RDF Parsing Options for Fabric Spark

| Library | Language | Formats Supported | Spark Compatible | Notes |
|---------|----------|-------------------|------------------|-------|
| **rdflib** | Python | Turtle, RDF/XML, N-Triples, JSON-LD, TriG | ✅ Yes (driver) | Most common Python library |
| **Apache Jena** | Java/Scala | All RDF formats | ✅ Yes | Full-featured, enterprise-grade |
| **Oxigraph** | Rust/Python | Turtle, N-Triples, RDF/XML | ✅ Yes | Fast, modern |
| **json-ld** | Python | JSON-LD only | ✅ Yes | Specialized for JSON-LD |

**Recommended Approach:**
1. Use `rdflib` for initial parsing (broad format support)
2. Convert to Spark DataFrame for transformations
3. Write to Delta tables for Fabric Graph consumption

### 4.4 User Interface Requirements

#### Target Platform: Fabric App (React)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Technology** | Fabric App (React) | Full custom UI, interactive decision-making |
| **Navigation** | Dashboard overview | See all decisions at once, pick any order |
| **Preview** | Essential | Must see sample nodes/edges before final import |
| **Project Model** | Multi-project | Each RDF source = saved project with decisions |
| **Execution** | Both | App-triggered pipeline + manual run option |

#### Primary Users

| Role | Responsibilities in App |
|------|------------------------|
| **Knowledge Graph Specialist** | Make B-category decisions, validate translations |
| **Business Analyst** | Provide domain context, review outputs |
| **Data Engineer** | Implement/maintain, run pipelines, troubleshoot |

#### User Journey Phases

| Phase | Interface | Key Actions |
|-------|-----------|-------------|
| **1. Project Setup** | Project list view | Create project, select RDF source location |
| **2. Data Discovery** | Schema explorer | View classes, properties, named graphs, statistics |
| **3. Decision-Making** | Dashboard + detail panels | Review all 12 B-decisions, make choices |
| **4. Preview** | Graph sample viewer | See sample nodes/edges with current decisions |
| **5. Execute** | Run panel | Trigger pipeline or export config for manual run |
| **6. Monitor** | Status dashboard | Track progress, view logs, handle errors |

#### UX Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| UX1 | Dashboard shows all 12 B-category decisions with status | Must |
| UX2 | Each decision has explanation panel with trade-offs | Must |
| UX3 | Each decision shows visual examples from loaded data | Must |
| UX4 | Preview panel shows sample translated nodes/edges | Must |
| UX5 | Decisions can be made in any order | Must |
| UX6 | Project saves all decisions for re-use | Must |
| UX7 | A-category auto-decisions shown as read-only info | Should |
| UX8 | C-category limitations shown as warnings | Should |
| UX9 | Export decisions as JSON config | Should |
| UX10 | Import decisions from previous project | Nice |

### 4.5 Development Environment
- Fabric Workspace(s): TBD (Dev / Test / Prod)
- Git Repository: This repo (`fabric_rdf_translation`)
- CI/CD: TBD
- Fabric Ontology/Graph: Preview (targeting GA compatibility)

---

## 5. Constraints & Assumptions

### 5.1 Constraints
- Fabric Ontology/Graph is in Preview - API/features may change
- RDF parsing libraries need to work in Spark environment

### 5.2 Assumptions
- Users have knowledge graph expertise to make modeling decisions
- Source RDF data is valid/well-formed
- Fabric workspace with sufficient capacity is available

### 5.3 Dependencies
- Microsoft Fabric Ontology & Graph (Preview)
- RDF parsing library (e.g., rdflib for Python)

---

## 6. Test Dataset

### 6.1 NEN 2660-2 Standard
The test dataset uses **NEN 2660-2**, a Dutch standard providing methodology for data models in the built environment.

**Available Files:**
| Type | Content |
|------|---------|
| Normative | SKOS, RDFS, OWL, SHACL definitions |
| Informative | TriG, JSON-LD, Turtle, RDF/XML |
| Examples | 4 TTL files: Bridge 1, Bridge 2, Road Network, Hospital |

### 6.2 Other Test Datasets
- TBD (application should work with any RDF dataset)

---

## 7. Open Questions

### Resolved ✅
| # | Question | Answer |
|---|----------|--------|
| 1 | Data format for Fabric Graph? | Delta Lake tables in managed Lakehouse |
| 2 | RDF parsing libraries? | rdflib (Python), Apache Jena (Java/Scala), Oxigraph |
| 3 | How does Graph import work? | Graph model maps node/edge types to Lakehouse table columns |
| 4 | Large file handling? | Fabric Spark with streaming processing |

### Still Open ❓
| # | Question | Context |
|---|----------|---------|
| 1 | Fabric Ontology definition format/API? | Need to understand exact schema structure |
| 2 | Fabric App vs Power BI for wizard UI? | Need to prototype decision workflow |
| 3 | How to handle OWL/SHACL in Fabric Ontology? | What subset is supported? |
| 4 | Schema evolution strategy? | Fabric Graph doesn't support schema changes - reingest required |
| 5 | Best Spark partitioning for large RDF files? | Performance optimization |
| 6 | Preview feature changes to track? | GA may change APIs |

---

## Revision History
| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-23 | 0.1 | | Initial draft |
| 2026-02-23 | 0.2 | | Added business problem, decision framework, limitations |
| 2026-02-23 | 0.3 | | Restructured decision framework into 3 categories (A/B/C), added Fabric technical requirements from docs research, added guidance requirements |
