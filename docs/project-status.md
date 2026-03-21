# Project Status - Fabric RDF Translation

> **Quick reference file.** For full context, see [project-context.md](project-context.md).

**Last Updated:** 2026-03-20  
**Phase:** Proof of Concept  
**Repository:** https://github.com/RemkoDeLange/rdf2fabric

---

## Project Context (Updated Mar 20)

**This is a Proof of Concept** for learning RDF → Fabric translation patterns. The focus is on:
- Exploring what's involved in RDF → LPG translation
- Understanding Fabric Ontology/Graph API capabilities and limitations
- Documenting modeling decisions required for the translation
- Building reusable patterns for future product development

**Not a production app** — The POC may inform a future Fabric product team import feature, but is not intended to compete with it.

---

## 2-Week Sprint (Mar 9-23): Demo-Ready Application

**Goal:** Scenario A (12 decisions) vs Scenario E (3-4 decisions) contrast with maximized Graph population.

### Sprint Progress: ~90% Complete (11/12 decisions implemented)

### Week 1: Data Completeness + Backend ✅ Complete

| Day | Task | Status | Notes |
|-----|------|--------|-------|
| 1-2 | **R18: Catch-all entity type** | ✅ Done | NB05+NB07 updated |
| 2 | Rerun NB01-NB09 | ✅ Done | 161 entities, 70 relationships |
| 2 | **Fix edge filter bug** | ✅ Done | Suffixed names now map correctly |
| 2 | **Fix property mapping** | ✅ Done | `uri` now exposed in GQL |
| 3 | Workspace config UI (F7.3) | ✅ Done | Settings page with workspace/lakehouse |
| 4 | File browser UI (F7.5) | ✅ Done | OneLake DFS API integration |
| 5 | Decision Dashboard (F7.6) | ✅ Done | 12 B-decisions with auto-resolve |

### Week 2: Decision Dashboard + Polish ✅ ~90% Complete

| Day | Task | Status | Notes |
|-----|------|--------|-------|
| 6 | Schema level selector | ✅ Done | Manual dropdown (0-4), auto-resolve |
| 6 | Project naming/rename | ✅ Done | Create with name, rename dialog |
| 7 | Scenario presets | ✅ Done | A/C/E buttons, one-click demo |
| 8 | Execute translation UI | ✅ Done | Pipeline progress, logs, status |
| 8 | **Config file architecture** | ✅ Done | App writes config, notebooks read it |
| 8 | **App → Fabric pipeline execution** | ✅ Done | Full pipeline running from app |
| 9 | **Server-side orchestrator** | ✅ Done | NB00 runs all steps, progress file polling |
| 10 | **Decision logic implementation** | ✅ Done | 11/12 B-decisions enforced in notebooks |
| 10 | **Multi-standard unit extraction** | ✅ Done | NEN 2660-2, QUDT, Schema.org |
| 11 | Demo polish | ⏳ In Progress | Screenshots, script |

### Decision Implementation Status

| Decision | Status | Notebook | Implementation |
|----------|--------|----------|----------------|
| B1: Node Type Strategy | ✅ | NB03 | class/predicate/uri_pattern |
| B2: Blank Node Handling | ✅ | NB05 | generate/inline/skolemize |
| B3: Multi-Type Resources | ✅ | NB05 | primary/first/duplicate |
| B4: Named Graph Strategy | ✅ | NB05 | property/partition/ignore |
| B5: Language Tag Handling | ✅ | NB04 | suffix/preferred/array |
| B6: Edge Type Derivation | ✅ | NB04 | property_name/domain_range |
| B7: Datatype Coercion | ✅ | NB06 | strict/string/infer |
| B8: Property Attachment | ⬜ | - | Low priority (reification rare) |
| B9: Edge vs Property | ✅ | NB04 | all_edges/enum_properties |
| B10: Inverse Properties | ✅ | NB04 | materialize/single_direction |
| B11: URI → ID Generation | ✅ | NB05 | local_name/label/hash |
| B12: Hierarchy Strategy | ✅ | NB03 | flatten/preserve/inherit |

### Current Graph Metrics (Mar 11 - Ziekenhuis minimal)

| Metric | Value | Notes |
|--------|-------|-------|
| Entity types (Ontology) | 74 | Minimal test (ziekenhuis only) |
| Relationship types (Ontology) | 48 | Type-specific (haspart_1, haspart_2, etc.) |
| Nodes in Graph | **59** | Verified via GQL |
| Edges in Graph | **372** | After bindings refresh |
| Node tables bound | 34 | Per-entity gold tables |
| Edge tables bound | 48 | Type-specific bindings |

---

## Current State

| Area | Status | Notes |
|------|--------|-------|
| **Pipeline (NB00-NB09)** | ✅ Working | End-to-end RDF → Fabric Graph with orchestrator |
| **Ontology API** | ✅ Working | 74 entity types, 48 relationships |
| **Graph Materialization** | ✅ Working | 59 nodes, 372 edges queryable |
| **GQL Queries** | ✅ Working | Basic patterns verified |
| **Property Access** | ✅ Working | `uri` property accessible via GQL |
| **SHACL Parsing** | ✅ Working | NB10-NB11 parse and validate |
| **React App** | ✅ Working | Auth, workspace config, file browser |
| **Decision Dashboard** | ✅ Working | 12 B-decisions with schema-based auto-resolve |
| **Project Management** | ✅ Working | Create, rename, delete projects |
| **Translation Execution** | ✅ Working | Full pipeline from app UI with progress tracking |
| **Config File Export** | ✅ Working | App writes `pipeline_run.json` to OneLake |
| **Ext. Ontology Fetcher (NB12)** | ✅ Working | HTTP fetch with content negotiation |
| **Ontology Enrichment (NB13)** | ✅ Working | Extracts labels, hierarchy, domains/ranges |
| **Label Enrichment (NB02/NB04)** | ✅ Working | External labels displayed in analysis output |

---

## F2.4: External Ontology Dereferencing ✅ Complete

**Branch:** `feature/f2.4-external-ontology-dereferencing`

**Goal:** Enable "follow your nose" Linked Data pattern — fetch schemas from external namespace URIs.

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| 1. App namespace selection UI | ✅ Done | Checkbox list, write manifest |
| 2. NB12 fetcher notebook | ✅ Done | HTTP fetch, content negotiation, cache to OneLake |
| 3. NB13 enrichment notebook | ✅ Done | Parse cached ontologies, extract labels/hierarchy |
| 4. Integration with schema detection | ✅ Done | NB02 loads `ontology_metadata.json`, shows `→` labels |
| 5. Integration with property mapping | ✅ Done | NB04 shows external labels for properties/edges |

### Test Results (Mar 20-21)

**Fetcher (NB12):** 5/6 ontologies fetched successfully (~5.9 MB total)
- ✅ `https://w3id.org/nen2660/def#` → 1647 triples
- ✅ `http://qudt.org/schema/qudt` → 2410 triples
- ✅ `http://qudt.org/vocab/unit/` → 81129 triples
- ✅ `http://qudt.org/vocab/quantitykind/` → 30512 triples
- ✅ `http://www.w3.org/2006/time#` → 1296 triples
- ❌ `https://w3id.org/ziekenhuis/def#` → 404 (project-local namespace, expected)

**Enrichment (NB13):** Metadata extraction complete
| Source | Classes | Properties | Labels |
|--------|---------|------------|--------|
| NEN 2660 | 45 | 38 | 188 |
| QUDT schema | 74 | 182 | 303 |
| QUDT quantitykind | 0 | 0 | 1,217 |
| QUDT unit | 0 | 0 | 2,900 |
| W3C Time | 20 | 58 | 97 |
| **Total** | 139 | 278 | 4,702 |

**Key Insight:** QUDT quantitykind/unit have 0 classes because they define *instances* (e.g., `unit:Meter`), not schema types. These 4,100+ labels are still valuable for human-readable display.

### Design Decision: External Property Inheritance (R19)

**Analysis:** NEN 2660-2 defines 93 properties on 26 abstract classes (e.g., `isConnectedTo` on `PhysicalObject`, `hasPart` on `Entity`). Should these properties be inherited by local entity types?

**Options Evaluated:**

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| A | Generate relationship types for all type pairs | Full inheritance | Exponential: 15 subtypes × 15 = 225 rel types per property |
| B | Generic `relatesTo` relationship | Simple | Loses semantic meaning |
| C | Data-driven only | Works now, no complexity | No abstract inheritance |

**Decision: Option C — Data-driven only**

**Rationale:**
1. **Fabric Ontology API limitation:** Relationship types require `source: {entityTypeId}`, `target: {entityTypeId}` — single IDs, not arrays. No polymorphism support.
2. **Instance-driven discovery already works:** NB07 discovers edge types from actual `gold_edges.type` data, inferring source/target entity types from real edge instances.
3. **Schema as documentation:** The external schema hierarchy (`schema_hierarchy`, `schema_properties`) is captured in `ontology_metadata.json` for display enrichment and future documentation features, but does not drive Fabric Ontology structure.
4. **Pragmatic for POC:** The 93 properties define what's *allowed*, not what *exists*. Our data-driven approach creates relationship types only for what actually exists in instance data.
| **Workspace Folders** | ✅ Working | Output items organized in folders |
| **Decision Enforcement** | ✅ Working | 11/12 decisions read from config + enforced |
| **Qualified Values** | ✅ Working | rdf:value extraction with multi-standard units |

---

## Decision Enforcement: Complete (Mar 20)

**Current State:**
- ✅ UI captures 12 B-decisions based on schema level
- ✅ Decisions stored in browser localStorage AND exported to OneLake
- ✅ App writes `Files/config/pipeline_run.json` with project settings
- ✅ NB00-NB09 read config file and branch logic based on decisions
- ✅ **11/12 decisions implemented** with full branching logic

**What This Means:**
- Changing a decision (e.g., B2: Blank Node Handling) in the UI writes to config
- Notebooks read the config and execute the appropriate logic path
- The demo shows both schema-driven decision reduction AND actual behavior changes
- B8 (Property Attachment) not implemented — reification patterns are rare in test data

**Feature Enhancements (Mar 20):**
- **Qualified value extraction** — NB05 now extracts `rdf:value` from qualified value patterns
- **Multi-standard unit detection** — Supports NEN 2660-2, QUDT 2.x, and Schema.org unit predicates

**See:** `docs/backlog.md` → Epic 13: Decision Enforcement (F13.1 ✅, F13.2 ✅, F13.3 ~90%)

---

## Next Phase: F2.4 External Ontology Dereferencing

**Priority Focus:** F2.4 enables "follow your nose" Linked Data pattern — automatically fetching schema from external namespace URIs.

### Implementation Plan (5-8 days)

| Phase | Tasks | Effort |
|-------|-------|--------|
| A | NB01 namespace detection + JSON output | S (1 day) |
| B | NB01b external ontology fetcher notebook | M (2-3 days) |
| C | App UI for namespace selection dialog | M (2-3 days) |
| D | Integration + cache management | S (1 day) |

### Key Deliverables

- `Files/config/detected_namespaces.json` output from NB01
- New `NB01b_external_ontology_fetcher` notebook
- `ExternalOntologyDialog` component in app
- Cache in `Files/cache/external_ontologies/`

---

## ⚠️ Known Limitations (POC Scope)

### Fabric Graph Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| No `labels()` function in GQL | Can't query all labels dynamically | Query specific node types |
| No `type()` for edges | Can't introspect edge types | Query specific edge types |
| Type-specific relationships | `hasPart` becomes `haspart_1`, `haspart_2` per source-target | Use exact relationship type |
| RefreshGraph performance | Can take 30+ minutes for large graphs | Plan refresh windows |
| ConcurrentOperation errors | Overlapping RefreshGraph jobs cancel | Single-threaded refresh |

### POC Scope Boundaries

| Item | Status | Notes |
|------|--------|-------|
| B8: Property Attachment | ⬜ Not Done | Reification patterns rare, low priority |
| F2.3: Large file streaming | ⬜ Deferred | RefreshGraph is bottleneck, not parsing |
| F3.3: Schema detection API | ⬜ Deferred | Not needed for POC |
| F7.7: Graph Preview | ⬜ Deferred | Nice to have, not priority |
| F13.4: Decision Preview | ⬜ Deferred | Nice to have, not priority |

---

## Fixes Applied (Mar 10)

### Fix 1: Edge Filter Mismatch
**Problem:** NB07 creates suffixed relationship names (`haspart_1`, `haspart_2`) for uniqueness, but NB09 used these suffixed names to filter `gold_edges.type` which contains the original names (`haspart`).

**Symptom:** Only 90 edges materialized (expected ~193).

**Solution:** In NB09, strip numeric suffix from rel_name to get original edge type:
```python
filter_value = re.sub(r'_\d+$', '', rel_name)
```

**Result:** 588 edges now materialized (multiple relationship types correctly mapping to same edge data).

### Fix 2: Property Mapping Skip
**Problem:** `uri` property was skipped in GraphModel with comment "'id' column already covers the URI" — but `id` is an internal hash, `uri` is the actual RDF IRI.

**Symptom:** `n.uri` returned error "Property 'uri' not found".

**Solution:** Removed the `uri` skip logic in NB09 node type and property mapping code.

### Fix 3: Step 4 Monitor-Only
**Problem:** `updateDefinition` auto-triggers RefreshGraph, so Step 4's explicit trigger was redundant (double refresh = 80+ minutes).

**Confirmed:** Via Fabric Monitor, jobs auto-start after updateDefinition.

**Solution:** Step 4 now only monitors for completion, never triggers explicitly.

---

## Fabric GQL Limitations Discovered

| Limitation | Workaround |
|------------|------------|
| No `labels()` function | Query specific node types |
| No `type()` function for edges | Query specific edge types or return edge directly |
| No `STARTS WITH` | Use full string match |
| Requires `AS` aliases | Always alias RETURN values |
| GROUP BY strict | Include all non-aggregated columns |
| **Type-specific relationships** | Use exact rel type with suffix (e.g. `haspart_1`) |

**Valid GQL patterns:**
```gql
MATCH (n) RETURN count(n) AS total
MATCH (b:Steelgirderbridge)-[r]->(part) RETURN b, part LIMIT 5
-- Note: Relationship types are source-target specific!
MATCH (z:Ziekenhuis)-[:haspart_1]->(r:Installatieruimte) RETURN DISTINCT z.uri, r.uri
MATCH (z:Ziekenhuis)-[:haspart_7]->(r:Operatiekamer) RETURN DISTINCT z.uri, r.uri
```

**Key Discovery (Mar 11):** Fabric Ontology creates **separate relationship types per source-target pair**. A single RDF property like `nen2660:hasPart` becomes multiple Fabric relationships:
- `haspart`: Gebouw → Gebouwconstructie
- `haspart_1`: Ziekenhuis → Installatieruimte
- `haspart_7`: Ziekenhuis → Operatiekamer
- etc.

This is different from Neo4j where one relationship type can connect any node types.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SOURCE (OneLake)                          │
│   Files/normative_nen2660/  Files/examples_nen2660/         │
└──────────────────────┬──────────────────────────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │       NB00: ORCHESTRATOR            │
    │  Runs NB01-NB09 server-side         │
    │  Writes progress to OneLake         │
    │  App polls progress file            │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │          BRONZE LAYER               │
    │  NB01: Parse RDF → bronze_triples   │
    │  NB02: Detect schema richness       │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │          SILVER LAYER               │
    │  NB03: Classes → silver_node_types  │
    │  NB04: Properties → silver_props    │
    │  NB05: Instances → silver_nodes     │
    │  NB10: SHACL → silver_constraints   │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │           GOLD LAYER                │
    │  NB06: Write gold_* Delta tables    │
    │  NB07: Generate Ontology definition │
    │  NB08: Send to Ontology API         │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │         DATA BINDING                │
    │  NB09: Bind tables → GraphModel     │
    │        RefreshGraph → Fabric Graph  │
    └─────────────────────────────────────┘
```

### Server-Side Execution (Mar 12)

**Problem:** Browser-based notebook execution breaks if tab closes during long pipelines.

**Solution:** Orchestrator pattern with progress file polling:
1. App triggers NB00 (orchestrator) once
2. NB00 runs NB01-NB09 via `mssparkutils.notebook.run()`
3. After each step, NB00 writes progress to `Files/config/pipeline_progress.json`
4. App polls progress file every 10 seconds
5. Browser can close; pipeline continues server-side

---

## Notebooks

| # | Name | Purpose | Status |
|---|------|---------|--------|
| 00 | pipeline_orchestrator | Server-side orchestration, progress file | ✅ |
| 01 | rdf_parser_jena | Parse RDF with Jena | ✅ |
| 02 | schema_detector | Detect schema richness (0-4) | ✅ |
| 03 | class_to_nodetype | Extract classes → entity types | ✅ |
| 04 | property_mapping | Map properties (datatype/object) | ✅ |
| 05 | instance_translator | RDF instances → silver_nodes | ✅ |
| 06 | delta_writer | Write gold Delta tables | ✅ |
| 07 | ontology_definition_generator | Generate Ontology JSON | ✅ |
| 08 | ontology_api_client | Push to Ontology REST API | ✅ |
| 09 | data_binding | Bind to GraphModel, RefreshGraph | ✅ |
| 10 | shacl_parser | Parse SHACL shapes | ✅ |
| 11 | shacl_validator | Validate with pySHACL | ✅ |

---

## Key Findings

1. **Fabric Graph uses GQL (ISO)**, not Gremlin
2. **Schema-enabled Lakehouse** requires `dbo.` prefix
3. **Ontology → Graph is automatic** via data binding
4. **Schema ≠ Instance predicates**: `hasFunctionalPart` vs `hasPart`
5. **RefreshGraph is async** — must poll for completion
6. **ConcurrentOperation** cancels overlapping RefreshGraph jobs

---

## Next Steps (Phase 2)

- [ ] Catch-all entity type for untyped instances (R18)
- [ ] Improve NB05 to extract all subjects/objects as nodes
- [ ] External ontology dereferencing (R2)
- [ ] SHACL constraint enforcement via Fabric Rules API (R8)
- [ ] Multi-valued property handling (R9)

---

## Quick Commands

```bash
# Run pipeline (via orchestrator)
NB00 (orchestrates NB01 → NB02 → ... → NB09)

# Or run notebooks individually
NB01 → NB02 → NB03 → NB04 → NB05 → NB06 → NB07 → NB08 → NB09

# Test GQL query (Graph Explorer)
MATCH (a)-[e]->(b) RETURN a.id, LABELS(e), b.id LIMIT 10

# Check edge types in SQL endpoint
SELECT type, COUNT(*) FROM dbo.gold_edges GROUP BY type ORDER BY COUNT(*) DESC
```
