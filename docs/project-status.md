# Project Status - Fabric RDF Translation

> **Quick reference file.** For full context, see [project-context.md](project-context.md).

**Last Updated:** 2026-03-10 (evening)  
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
| 3 | Workspace config UI (F7.3) | ⬜ | First-run setup |
| 4 | Fabric API service | ⬜ | Bridge UI to notebooks |
| 5 | File browser UI (F7.5) | ⬜ | Select RDF files |

### Week 2: Decision Dashboard + Polish

| Day | Task | Status | Notes |
|-----|------|--------|-------|
| 6-7 | Decision Dashboard (F7.6) | ⬜ | Show all 12 B-decisions |
| 8 | Schema detection + presets | ⬜ | Scenario A/E buttons |
| 9 | Execute translation UI | ⬜ | Trigger pipeline |
| 10 | Demo polish | ⬜ | Screenshots, script |

### Current Graph Metrics (Mar 10)

| Metric | Value | Notes |
|--------|-------|-------|
| Entity types (Ontology) | 86 | After skip schema classes |
| Relationship types (Ontology) | 105 | Instance-driven |
| Nodes in Graph | **159** | Verified via GQL |
| Edges in Graph | **588** | After filter fix |
| Node tables bound | 86 | Gold tables mapped |
| Edge tables bound | 77 | Some skipped (missing source/target) |

---

## Current State

| Area | Status | Notes |
|------|--------|-------|
| **Pipeline (NB01-NB09)** | ✅ Working | End-to-end RDF → Fabric Graph |
| **Ontology API** | ✅ Working | 86 entity types, 105 relationships |
| **Graph Materialization** | ✅ Working | 159 nodes, 588 edges queryable |
| **GQL Queries** | ✅ Working | Basic patterns verified |
| **Property Access** | 🔄 Pending | Fix deployed, needs re-run |
| **SHACL Parsing** | ✅ Working | NB10-NB11 parse and validate |
| **React App** | 🟡 Scaffolded | Auth working, pages stubbed |

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
| No `type()` for edges | Query specific edge types |
| No `STARTS WITH` | Use full string match |
| Requires `AS` aliases | Always alias RETURN values |
| GROUP BY strict | Include all non-aggregated columns |

**Valid GQL patterns:**
```gql
MATCH (n) RETURN count(n) AS total
MATCH (b:Steelgirderbridge)-[r]->(part) RETURN b, part LIMIT 5
MATCH (a)-[:haspart]->(b) RETURN a.uri AS source, b.uri AS target LIMIT 10
```
| R17 | Instance-driven relationship types | Hybrid | 🔄 |
| R18 | Orphan edge targets | **Catch-all AdHocEntity** | ✅ Implemented |

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
