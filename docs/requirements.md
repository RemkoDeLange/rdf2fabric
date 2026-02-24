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

- [x] **Generic Tool**: Build a reusable application (not a one-time ETL) that can translate *any* RDF dataset to Fabric Graph, regardless of domain or ontology (DBpedia, schema.org, FIBO, custom ontologies, etc.)
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

### 2.2 Schema Richness Levels

**Critical:** The quality and automation of RDF → Fabric translation depends heavily on schema availability. The application detects **five levels** of schema richness, each enabling more auto-resolved decisions.

#### Level Overview

| Level | Available | Detection Criterion | User Decisions |
|-------|-----------|---------------------|----------------|
| **0** | Instance data only | No schema predicates found | All 12 B-decisions |
| **1** | SKOS vocabulary | `skos:ConceptScheme`, `skos:Concept` | 11 B-decisions |
| **2** | RDFS schema | `rdfs:Class`, `rdfs:Property` | 7 B-decisions |
| **3** | OWL ontology | `owl:Class`, `owl:ObjectProperty` | 5 B-decisions |
| **4** | SHACL shapes | `sh:NodeShape`, `sh:property` | 3-4 B-decisions |

> **See:** [data-sources.md](data-sources.md) Section 3 for detailed level definitions and B-decision impact matrix.

#### What Each Level Provides

| Level | Node Types | Edge Types | Datatypes | Validation |
|-------|------------|------------|-----------|------------|
| 0 | Inferred from `rdf:type` | Inferred from predicates | From literals | None |
| 1 | From `skos:Concept` | Inferred | From literals | None |
| 2 | From `rdfs:Class` | From `rdfs:Property` + range | From `rdfs:range` | None |
| 3 | From `owl:Class` | From `owl:ObjectProperty` | Full type system | Logical (partial) |
| 4 | From SHACL shapes | From `sh:path` | From `sh:datatype` | Full SHACL |

#### Level 0 Guidance (Instance-Only Mode)

When schema level is 0, the application MUST:
1. **Show warning**: "No schema detected - translation based on instance patterns"
2. **Display confidence scores** for inferred classes/properties
3. **Allow manual additions**: User can correct/add schema elements
4. **Recommend schema upload** if available elsewhere
5. **Use conservative defaults**: Err on explicit modeling

**Instance-Only Limitations:**
- Classes with no instances are invisible
- Property domains/ranges are guessed from usage
- No guarantee of schema completeness
- All 12 B-category decisions require user input
- Higher risk of incorrect mappings

#### Progressive Schema Detection Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PROGRESSIVE SCHEMA DETECTION                     │
│                                                                     │
│  User uploads files                                                  │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────┐                                                │
│  │ Parse all files │                                                │
│  │ Scan predicates │                                                │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  ┌────────────────────────┐    YES    ┌─────────────────┐          │
│  │ sh:NodeShape found?    │──────────►│   LEVEL 4       │          │
│  └──────────┬─────────────┘           │ Full SHACL      │          │
│             │ NO                      └─────────────────┘          │
│             ▼                                                       │
│  ┌────────────────────────┐    YES    ┌─────────────────┐          │
│  │ owl:Class found?       │──────────►│   LEVEL 3       │          │
│  └──────────┬─────────────┘           │ OWL Ontology    │          │
│             │ NO                      └─────────────────┘          │
│             ▼                                                       │
│  ┌────────────────────────┐    YES    ┌─────────────────┐          │
│  │ rdfs:Class found?      │──────────►│   LEVEL 2       │          │
│  └──────────┬─────────────┘           │ RDFS Schema     │          │
│             │ NO                      └─────────────────┘          │
│             ▼                                                       │
│  ┌────────────────────────┐    YES    ┌─────────────────┐          │
│  │ skos:Concept found?    │──────────►│   LEVEL 1       │          │
│  └──────────┬─────────────┘           │ SKOS Vocab      │          │
│             │ NO                      └─────────────────┘          │
│             ▼                                                       │
│  ┌─────────────────┐                                                │
│  │   LEVEL 0       │                                                │
│  │ Instance-only   │                                                │
│  └─────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Translation Decision Framework

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

The application must guide users through these decisions with sufficient context.

**Schema Impact Legend:**
- 🟢 **Auto with RDFS**: Decision can be auto-resolved when schema is available
- 🟡 **Guided with RDFS**: Schema provides useful hints, but user still decides
- ⚪ **Schema-independent**: Decision is the same regardless of schema availability

| ID | Decision | Options | Schema Impact | Guidance to Provide |
|----|----------|---------|---------------|---------------------|
| B1 | **Class Membership Encoding** | • Node label<br>• Property `type`<br>• Type-node + edge | 🟢 Auto: `rdfs:Class` → labels | Explain: Labels are query-optimized; properties allow multiple types |
| B2 | **RDF Containers/Collections** | • Array property<br>• Linked list nodes<br>• Indexed edges | ⚪ Independent | Show examples of each; arrays are simpler but lose order semantics |
| B3 | **OWL/SHACL Constraints** | • Encode as schema<br>• Store as metadata<br>• Ignore at runtime | 🟡 Guided: constraints visible | Fabric Ontology can capture some; full OWL cannot be enforced |
| B4 | **Named Graphs** | • Separate subgraphs<br>• Tags on edges<br>• Property `graph` | ⚪ Independent | Important for provenance; show data volume implications |
| B5 | **Namespace Strategy** | • Prefix convention<br>• Full name property<br>• Tagging system | 🟡 Guided: prefixes from schema | Show examples: `schema:Person` vs `Person` vs tag `schema` |
| B6 | **Inference Materialization** | • Precompute all<br>• Selected predicates only<br>• None (asserted only) | 🟢 Auto: use `rdfs:subClassOf` | Critical: Explain storage cost vs query simplicity trade-off |
| B7 | **Complex N-ary Patterns** | • Event/measurement node<br>• Edge properties<br>• Intermediate nodes | 🟡 Guided: patterns in schema | Show common patterns (observations, qualified relations) |
| B8 | **Fabric Ontology Mapping** | • Full schema encoding<br>• Core entities only<br>• Metadata documentation | 🟢 Auto: RDFS → Ontology | Direct mapping from rdfs:Class/Property to Fabric Ontology |
| B9 | **Multi-valued Properties** | • Array property<br>• Multiple edges<br>• First value only | 🟡 Guided: `rdfs:range` hints | RDF naturally supports; LPG arrays may have query limitations |
| B10 | **Language Tags** | • Separate properties per lang<br>• Nested object<br>• Ignore | 🟡 Guided: `rdfs:label` patterns | Show: `label_en`, `label_nl` vs `label: {en: "...", nl: "..."}` |
| B11 | **Inverse Properties** | • Keep both directions<br>• One direction + query<br>• Materialize missing | 🟢 Auto: `owl:inverseOf` | Storage vs query trade-off |
| B12 | **SKOS Concepts** | • Hierarchical edges<br>• Flattened labels<br>• Tree structure | 🟢 Auto: SKOS structure known | Common for taxonomies; show visualization implications |

**Summary: Schema Level Impact on Decisions**

| Schema Level | Auto-Resolved | Guided/Hints | Manual | Example |
|--------------|---------------|--------------|--------|---------|
| **Level 0** (Instance-only) | 0 | 0 | 12 | Ad-hoc data export |
| **Level 1** (SKOS) | 1 (B12) | 1 (B11) | 10 | Vocabulary/taxonomy |
| **Level 2** (RDFS) | 5 (B1,B6,B8,B11,B12) | 2 (B7,B9) | 5 | Standard semantic data |
| **Level 3** (OWL) | 7 (+B9,B10) | 2 (B3,B7) | 3 | Rich ontology |
| **Level 4** (SHACL) | 8 (+B7) | 1 (B3) | 3 | Complete validation |

> **See:** [data-sources.md](data-sources.md) Section 3.3 for full B-decision impact matrix by level.

**Requirement: For each B-category decision, the application MUST provide:**
1. Clear explanation of the trade-offs
2. Visual example of each option (from actual source data)
3. Recommendation based on common use cases
4. **Schema level indicator** showing if auto-resolved, guided, or manual
5. Ability to preview impact before committing
6. Option to override auto-resolved decisions if needed

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
| **SPARQL Incompatibility** | Existing SPARQL queries will not work | Must rewrite as GQL (Fabric Graph query language) |
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

**Data Volume Categories:**
| Category | Triple Count | Example |
|----------|--------------|----------|
| Small | < 10,000 | Test files, single domain |
| Medium | 10,000 - 1,000,000 | Department-level data |
| Large | > 1,000,000 | Enterprise-wide data |

**Processing Time Targets:**
| Operation | Small | Medium | Large |
|-----------|-------|--------|-------|
| Schema detection | < 30 sec | < 30 sec | < 60 sec |
| RDF parsing & analysis | < 2 min | < 15 min | < 60 min |
| Translation to Delta | < 2 min | < 15 min | < 60 min |
| Fabric Graph import | Fabric API-dependent | Fabric API-dependent | Fabric API-dependent |

> **Note:** Fabric Graph import timing is outside our control - depends on Microsoft's API performance.

- Query response time: N/A (batch processing)

### 3.2 Security & Compliance

**Data Classification:**
- Source data classification: User responsibility (app doesn't auto-classify PII)
- Intermediate storage: Inherits Fabric workspace security

**Access Control:**
- Fabric workspace RBAC (Admin/Member/Contributor/Viewer)
- No additional role model in application

**Compliance:**
- Data residency: Inherits from Fabric tenant configuration
- Audit logging: Fabric Activity Log + notebook run history (built-in)
- Data retention: Follows Fabric workspace defaults
- GDPR/privacy: User responsibility to classify and handle PII in source data

### 3.3 Availability
- Uptime requirements: N/A (tool, not service)
- Disaster recovery: Git-based, Fabric workspace backup

### 3.4 Distribution & Deployment

**Target Audience:**
- External organizations (different Entra tenants)
- Users install in their own environment
- No shared infrastructure dependency

**Distribution Method:**
| Component | Distribution | Location |
|-----------|--------------|----------|
| Fabric Backend | GitHub (clone/fork) | Import to user's Fabric via Git integration |
| Web App | `azd up` template | Deploy to user's Azure subscription |
| Desktop App | GitHub Releases | Download installer (`.exe` / `.dmg` / `.AppImage`) |
| Documentation | GitHub | Included in repo |

**Workspace Strategy:**
> **The app does NOT create workspaces.** Customer chooses where to install.

| Option | Scenario |
|--------|----------|
| New dedicated workspace | Clean isolation, recommended for production use |
| Existing workspace | Add tool to current data engineering workspace |

On first app launch, customer configures their Fabric workspace URL. The app stores this in local settings.

**User Installation Options:**

*Option A: Web App*
1. Clone/fork GitHub repository
2. Create or choose a Fabric workspace
3. Connect workspace to GitHub (Settings → Git integration) → auto-imports notebooks/pipelines
4. Run `azd up` → deploys web app to their Azure
5. Open browser, login with Entra SSO
6. Configure Fabric workspace URL on first run

*Option B: Desktop App (Simpler)*
1. Create or choose a Fabric workspace
2. Fork repo and connect workspace to GitHub → auto-imports notebooks/pipelines
3. Download installer from GitHub Releases
4. Run app, login with Entra device code flow
5. Configure Fabric workspace URL on first run

**Cross-Tenant Authentication:**
- Web App: Entra ID SSO (redirect flow)
- Desktop App: Entra ID device code flow (works across tenants)
- Both use delegated permissions to call Fabric REST API

---

## 4. Technical Requirements

### 4.1 Fabric Workloads Needed
- [x] Lakehouse - Store intermediate and final data (Delta tables)
- [x] Notebooks - RDF parsing, transformation logic (Spark)
- [x] Data Pipelines - Orchestrate the translation workflow
- [ ] Data Warehouse - Not needed
- [ ] Real-Time Intelligence - Not needed
- [ ] Power BI Reports - Not needed (UI is external app)
- [x] Fabric Ontology - Target ontology definition
- [x] Fabric Graph - Target graph database

> **Note:** The user interface runs **outside** Fabric as either a web app (Azure Static Web App) or desktop app (Electron). See Section 3.4 for distribution details.

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
| **Apache Jena** | Java/Scala | All RDF formats (Turtle, RDF/XML, N-Triples, N-Quads, JSON-LD, TriG, TriX, RDF/JSON, etc.) | ✅ Yes (native) | Enterprise-grade, widest format support, SPARQL engine |
| **rdflib** | Python | Turtle, RDF/XML, N-Triples, JSON-LD, TriG | ✅ Yes (driver) | Python ecosystem, good for prototyping |
| **Oxigraph** | Rust/Python | Turtle, N-Triples, RDF/XML | ✅ Yes | Fast, modern |

**Recommended Approach:**
1. Use **Apache Jena** (Scala) for RDF parsing - widest format support, enterprise-grade
2. Use Python notebooks for orchestration and Fabric API integration
3. Mix Scala and Python notebooks as needed (Fabric supports both)
4. Convert to Spark DataFrame for transformations
5. Write to Delta tables for Fabric Graph consumption

> **Note:** Notebooks can be written in Python, Scala, or a mix - choose the best tool for each task. Apache Jena's native Spark integration is more efficient than Python driver-based parsing for large files.

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
| UX5 | Decisions can be made in any order (non-linear) | Must |
| UX6 | Project saves all decisions for re-use | Must |
| UX7 | A-category auto-decisions shown as read-only info | Should |
| UX8 | C-category limitations shown as warnings | Should |
| UX9 | Export decisions as JSON config | Should |
| UX10 | Import decisions from previous project | Nice |
| **UX11** | **Adaptive guidance sequence based on input scenario** | **Must** |
| **UX12** | **Highlight recommended next decision based on context** | **Should** |
| **UX13** | **Skip/hide irrelevant decisions for current scenario** | **Should** |

### 4.6 Adaptive Guidance Sequencing

The application must intelligently adapt its guidance flow based on what files the user provides. This is NOT a fixed wizard - users can still navigate freely - but the app **recommends** an optimal sequence and **highlights** what to focus on.

#### Scenario-Specific Guidance Flows

| Scenario | Input Files | Guidance Behavior |
|----------|-------------|-------------------|
| **A** | Instances only (Level 0) | Show all 12 decisions; **recommend** starting with B1 (Class Encoding) → B6 (Inference) → B8 (Ontology); warn about low confidence |
| **B** | Instances + SKOS (Level 1) | Auto-resolve B12 (SKOS); **recommend** B1 → B6 → B8; show SKOS hierarchy in preview |
| **C** | Instances + RDFS (Level 2) | Auto-resolve B1, B6, B8, B11, B12; **highlight** remaining 7 decisions; guide B7 (Datatypes) first |
| **D** | Instances + OWL (Level 3) | Auto-resolve 7 decisions; **focus** on B2, B4, B5; show OWL semantics that won't transfer |
| **E** | Full dataset (Level 4) | Auto-resolve 8 decisions; minimal guidance; **validate** with SHACL before translation |
| **F** | Schema only (no instances) | **Schema exploration mode**: Show ontology structure, preview empty Graph skeleton, no instance decisions needed |

#### Adaptive Guidance Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADAPTIVE GUIDANCE FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ANALYZE INPUT                                                           │
│     ├─► Detect schema level (0-4)                                           │
│     ├─► Identify file types (schema vs instance)                            │
│     └─► Check for special patterns (named graphs, collections, etc.)        │
│                                                                             │
│  2. CATEGORIZE DECISIONS                                                    │
│     ├─► Auto-resolved: Mark complete, show as read-only (overridable)      │
│     ├─► Guided: Schema provides hints, recommend specific option            │
│     ├─► Manual: No hints, require user choice                               │
│     └─► Irrelevant: Hide or grey out (e.g., B4 if no named graphs)         │
│                                                                             │
│  3. DETERMINE PRIORITY ORDER                                                │
│     ├─► High-impact decisions first (B1, B6, B8 affect everything)          │
│     ├─► Dependent decisions after prerequisites                             │
│     └─► Low-impact / cosmetic decisions last (B5, B10)                      │
│                                                                             │
│  4. PRESENT DASHBOARD                                                       │
│     ├─► "Recommended next" badge on priority decision                       │
│     ├─► Progress bar: "X of Y decisions remaining"                          │
│     ├─► Completion blockers: "Cannot preview until B1, B6 decided"          │
│     └─► All decisions still accessible (non-linear navigation)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Decision Dependencies

Some decisions have logical dependencies:

| Decision | Depends On | Reason |
|----------|------------|--------|
| B8 (Ontology Mapping) | B1 (Class Encoding) | Ontology structure follows class strategy |
| B9 (Multi-valued Props) | B6 (Inference) | Affects whether inferred properties are multi-valued |
| B7 (Datatype Coercion) | B8 (Ontology Mapping) | Datatypes must align with ontology |
| B4 (Named Graphs) | - | Independent, but irrelevant if no named graphs in input |
| B12 (SKOS Concepts) | - | Independent, but irrelevant if no SKOS in input |

### 4.7 Development Environment

**Fabric Workspaces:**
| Environment | Workspace Name | Purpose |
|-------------|----------------|----------|
| Development | `ws-rdf_translation-dev-01` | Active development and testing |
| Test | `ws-rdf_translation-test-01` | Integration testing before prod |
| Production | `ws-rdf_translation-prod-01` | End-user facing deployment |

**Git Repository:**
- Repository: This repo (`fabric_rdf_translation`)
- Branching Strategy: `main` → `develop` → `feature/*` branches
- PR workflow: Feature branches merge to `develop`, `develop` merges to `main`

**CI/CD Strategy:**
| Stage | Tool | Trigger |
|-------|------|----------|
| Linting | GitHub Actions | On PR to `develop` |
| Unit Tests | GitHub Actions (pytest) | On PR to `develop` |
| Deploy to Dev | Fabric Git integration | On merge to `develop` |
| Deploy to Test | Fabric Deployment Pipeline | Manual trigger |
| Deploy to Prod | Fabric Deployment Pipeline | Manual trigger + approval |

> **Note:** See `.github/workflows/` for GitHub Actions configuration.

**Fabric Ontology/Graph:**
- Status: Preview (targeting GA compatibility)
- Risk: API/features may change - see Open Questions section

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
- RDF parsing: Apache Jena (Scala) preferred, rdflib (Python) for orchestration

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
