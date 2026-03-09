# Project Status - Fabric RDF Translation

> **Quick reference file.** For full context, see [project-context.md](project-context.md).

**Last Updated:** 2026-03-09 (evening)  
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

### Achieved After R18

| Metric | Before | After |
|--------|--------|-------|
| Entity types | 17 | **161** |
| Relationship types | 7 | **70** |
| Node bindings | 11 | **76** |
| Edge bindings | 4 | **71** |
| Gold nodes | 36 | **264** |
| Gold edges | 185 | **200** |

---

## Current State

| Area | Status | Notes |
|------|--------|-------|
| **Pipeline (NB01-NB09)** | ✅ Working | End-to-end RDF → Fabric Graph |
| **Ontology API** | ✅ Working | **161 entity types, 70 relationships** |
| **Graph Queries** | ✅ Working | **71 of 70 edge types** bound; RefreshGraph pending |
| **SHACL Parsing** | ✅ Working | NB10-NB11 parse and validate |
| **React App** | 🟡 Scaffolded | Auth working, pages stubbed |

---

## R18: AdHocEntity — ✅ COMPLETE

**Problem solved:** 39% of edges (`haspart`) weren't queryable because target nodes didn't exist in gold tables.

**Solution implemented:**
- NB05: Extract orphan URIs → AdHocEntity nodes in gold_nodes
- NB07: Add synthetic AdHocEntity to ontology definition
- NB07: Instance-driven relationship discovery from gold_edges (not schema)
- NB07: Numeric suffixes for duplicate relationship names (truncation fix)

**Results:**
| Metric | Before | After |
|--------|--------|-------|
| Entity types | 17 | 161 |
| Relationship types | 7 | 70 |
| `haspart` variants | 0 | 3 (`haspart`, `haspart_1`, `haspart_2`) |
| Edge bindings | 4 | 71 |

**Pending:** RefreshGraph job queued (long-running). After completion, all 200 edges should be queryable.

---

## RDF Decisions Summary

| ID | Decision | Choice | Status |
|----|----------|--------|--------|
| R1 | Language preference | `en` (English) | ✅ |
| R2 | External ontology dereferencing | Local only | ⬜ P2 |
| R3 | Class discovery sources | Include ranges + domains | ✅ |
| R4 | Duplicate triple handling | Keep all (provenance) | ✅ |
| R5 | OWL property type URIs | Full URI in bronze | ✅ |
| R6 | Case sensitivity | Case-insensitive | ✅ |
| R7 | Blank node handling | Include with `_:label` | ✅ |
| R8 | SHACL constraint storage | Store in silver_constraints | ⬜ P2 |
| R9 | Multi-valued properties | TBD | ⬜ |
| R10 | Inverse properties | TBD | ⬜ |
| R11 | Named graph handling | TBD | ⬜ |
| R12 | rdf:type materialization | Node label | ✅ |
| R13 | Blank nodes as entity types | Filter out | ✅ |
| R14 | Label language fallback | Fallback with warning | ✅ |
| R15 | Missing domain/range | Leave open | ✅ |
| R16 | Implicit SHACL class targeting | Include implicit | ✅ |
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
