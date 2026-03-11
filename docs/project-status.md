# Project Status - Fabric RDF Translation

> **Quick reference file.** For full context, see [project-context.md](project-context.md).

**Last Updated:** 2026-03-11 (late evening)  
**Phase:** Proof of Concept  
**Repository:** https://github.com/RemkoDeLange/rdf2fabric

---

## 2-Week Sprint (Mar 9-23): Demo-Ready Application

**Goal:** Scenario A (12 decisions) vs Scenario E (3-4 decisions) contrast with maximized Graph population.

### Week 1: Data Completeness + Backend

| Day | Task | Status | Notes |
|-----|------|--------|-------|
| 1-2 | **R18: Catch-all entity type** | ✅ Done | NB05+NB07 updated |
| 2 | Rerun NB01-NB09 | ✅ Done | 161 entities, 70 relationships |
| 2 | **Fix edge filter bug** | ✅ Done | Suffixed names now map correctly |
| 2 | **Fix property mapping** | ✅ Done | `uri` now exposed in GQL |
| 3 | Workspace config UI (F7.3) | ✅ Done | Settings page with workspace/lakehouse |
| 4 | File browser UI (F7.5) | ✅ Done | OneLake DFS API integration |
| 5 | Decision Dashboard (F7.6) | ✅ Done | 12 B-decisions with auto-resolve |

### Week 2: Decision Dashboard + Polish

| Day | Task | Status | Notes |
|-----|------|--------|-------|
| 6 | Schema level selector | ✅ Done | Manual dropdown (0-4), auto-resolve |
| 6 | Project naming/rename | ✅ Done | Create with name, rename dialog |
| 7 | Scenario presets | ✅ Done | A/C/E buttons, one-click demo |
| 8 | Execute translation UI | ✅ Done | Pipeline progress, logs, status |
| 8 | **Config file architecture** | ✅ Done | App writes config, notebooks read it |
| 8 | **App → Fabric pipeline execution** | ✅ Done | Full pipeline running from app |
| 9-10 | Demo polish | ⬜ | Screenshots, script |

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
| **Pipeline (NB01-NB09)** | ✅ Working | End-to-end RDF → Fabric Graph |
| **Ontology API** | ✅ Working | 74 entity types, 48 relationships |
| **Graph Materialization** | ✅ Working | 59 nodes, 372 edges queryable |
| **GQL Queries** | ✅ Working | Basic patterns verified |
| **Property Access** | ✅ Working | `uri` property accessible via GQL |
| **SHACL Parsing** | ✅ Working | NB10-NB11 parse and validate |
| **React App** | ✅ Working | Auth, workspace config, file browser |
| **Decision Dashboard** | ✅ Working | 12 B-decisions with schema-based auto-resolve |
| **Project Management** | ✅ Working | Create, rename, delete projects |
| **Translation Execution** | ✅ Working | Full pipeline from app UI |
| **Config File Export** | ✅ Working | App writes `pipeline_run.json` to OneLake |
| **Workspace Folders** | ✅ Working | Output items organized in folders |

---

## ⚠️ Known Gaps (POC Scope)

### Decision Enforcement Partially Implemented

**Current State:**
- ✅ UI captures 12 B-decisions based on schema level
- ✅ Decisions stored in browser localStorage AND exported to OneLake
- ✅ App writes `Files/config/pipeline_run.json` with project settings
- ✅ NB08 reads config file and uses `folder_id` + `project_name`
- ⚠️ **Decision branching logic** NOT yet implemented in notebooks

**What This Means:**
- Changing a decision (e.g., B2: Blank Node Handling) in the UI writes to config
- Notebooks **can read** the config but don't yet **act on** decision values
- The demo shows schema-driven decision reduction + config export
- Actual translation behavior still uses defaults (decision branches not implemented)

**Phase 2 Work Required (Epic 13):**
1. ~~**F13.1** - Export decisions to OneLake config file~~ ✅ Complete
2. **F13.2** - Notebooks read config and branch logic (partially done)
3. **F13.3** - Implement decision logic in notebooks (XL effort: ~2-3 weeks)

**See:** `docs/backlog.md` → Epic 13: Decision Enforcement

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

---

## Notebooks

| # | Name | Purpose | Status |
|---|------|---------|--------|
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
# Run notebooks in order (Fabric)
NB01 → NB02 → NB03 → NB04 → NB05 → NB06 → NB07 → NB08 → NB09

# Test GQL query (Graph Explorer)
MATCH (a)-[e]->(b) RETURN a.id, LABELS(e), b.id LIMIT 10

# Check edge types in SQL endpoint
SELECT type, COUNT(*) FROM dbo.gold_edges GROUP BY type ORDER BY COUNT(*) DESC
```
