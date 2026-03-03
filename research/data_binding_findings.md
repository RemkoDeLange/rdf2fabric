# Fabric Ontology Data Binding - Research Findings

**Date:** 2026-03-03  
**Script:** `research/data_binding_research.py`  
**Status:** ✅ All critical tests PASSED

---

## Executive Summary

Data binding via the Fabric Ontology REST API **works successfully** when the correct LRO result pattern is used. The previous `ALMOperationImportFailed` error in notebook 09 was caused by the broken `getDefinition` LRO handling (calling `getDefinition` again after LRO instead of using `{operationUrl}/result`), which meant entity type definitions were never read back properly, leading to missing or incorrect IDs in binding payloads.

---

## Test Results

| Test | Description | Result | Key Finding |
|------|-------------|--------|-------------|
| 1 | Discover IDs | ✅ PASS | Workspace/lakehouse discovery works |
| 3 | Minimal data binding | ✅ PASS | Single entity, single property binding works |
| 5 | Relationship contextualization | ✅ PASS | Entity bindings + relationship contextualizations in one upload |
| 6 | Real table binding | ✅ PASS | Binding to actual `gold_nodes` table works |

---

## Critical Fix: getDefinition LRO Pattern

### The Problem
The Fabric `POST /ontologies/{id}/getDefinition` endpoint **always returns 202** (Long-Running Operation). Previously, the code would:
1. Call `getDefinition` → get 202
2. Poll the LRO until Succeeded
3. Call `getDefinition` **again** → still get 202 (not 200!)

This meant definitions were **never successfully read back**, causing cascading failures in data binding.

### The Solution
After the LRO succeeds, the actual definition data is at `{operationUrl}/result`:

```python
# 1. POST getDefinition → 202 + Location header
resp = api.post(f".../ontologies/{id}/getDefinition", {})

# 2. Extract operation URL from Location header
op_url = resp.headers.get("Location")  
# e.g.: https://wabi-west-us-e-primary-redirect.analysis.windows.net/v1/operations/{opId}

# 3. Poll until Succeeded
while True:
    r = requests.get(op_url, headers=auth_headers)
    if r.json()["status"] == "Succeeded":
        break

# 4. GET the RESULT from {operationUrl}/result
result = requests.get(f"{op_url}/result", headers=auth_headers)
definition = result.json()  # Contains the full definition with parts
```

---

## Data Binding Payload Structure

### Entity Type Data Binding

**Path:** `EntityTypes/{entityTypeId}/DataBindings/{uuid}.json`

```json
{
  "id": "dd95e300-25d4-4049-90a0-37ed3c63d5ed",
  "dataBindingConfiguration": {
    "dataBindingType": "NonTimeSeries",
    "propertyBindings": [
      {
        "sourceColumnName": "id",
        "targetPropertyId": "3001001001001"
      }
    ],
    "sourceTableProperties": {
      "sourceType": "LakehouseTable",
      "workspaceId": "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5",
      "itemId": "32e17923-0b8b-4106-953a-6d63081fa361",
      "sourceTableName": "gold_nodes",
      "sourceSchema": "dbo"
    }
  }
}
```

**Schema added by Fabric:** `$schema: https://developer.microsoft.com/json-schemas/fabric/item/ontology/dataBinding/1.0.0/schema.json`

### Relationship Contextualization

**Path:** `RelationshipTypes/{relationshipTypeId}/Contextualizations/{uuid}.json`

```json
{
  "id": "3a5f2567-6789-4ce3-a583-3154b4ee6fd5",
  "dataBindingTable": {
    "sourceType": "LakehouseTable",
    "workspaceId": "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5",
    "itemId": "32e17923-0b8b-4106-953a-6d63081fa361",
    "sourceTableName": "gold_edges",
    "sourceSchema": "dbo"
  },
  "sourceKeyRefBindings": [
    {
      "sourceColumnName": "source_id",
      "targetPropertyId": "3001001001001"
    }
  ],
  "targetKeyRefBindings": [
    {
      "sourceColumnName": "target_id",
      "targetPropertyId": "6001001001001"
    }
  ]
}
```

**Schema added by Fabric:** `$schema: https://developer.microsoft.com/json-schemas/fabric/item/ontology/contextualization/1.0.0/schema.json`

---

## Key Requirements

| Requirement | Value | Notes |
|-------------|-------|-------|
| Entity type IDs | **String** (not int) | e.g., `"1001001001001"` |
| Property IDs | **String** (not int) | Must match exactly |
| Binding ID | **UUID v4** | e.g., `"dd95e300-25d4-4049-90a0-37ed3c63d5ed"` |
| sourceType | `"LakehouseTable"` | Only tested type |
| sourceSchema | `"dbo"` | Always "dbo" for Fabric Lakehouse |
| dataBindingType | `"NonTimeSeries"` | For static bindings |
| Update approach | **Include all existing parts** | Upload entity defs + bindings together |

---

## Upload Flow

```
1. Create ontology:     POST /ontologies → 202 → LRO
2. Upload entity types: POST /ontologies/{id}/updateDefinition → 202 → LRO
3. Read back definition: POST /ontologies/{id}/getDefinition → 202 → LRO → GET {opUrl}/result
4. Add bindings to parts: Append DataBindings + Contextualizations to existing parts
5. Upload with bindings: POST /ontologies/{id}/updateDefinition → 202 → LRO → Succeeded ✅
```

### Definition Parts Structure (complete upload with bindings)

```
.platform                                              (metadata)
definition.json                                         (empty or config)
EntityTypes/{id1}/definition.json                       (entity type definition)
EntityTypes/{id1}/DataBindings/{uuid}.json              (entity data binding)
EntityTypes/{id2}/definition.json                       (another entity type)
EntityTypes/{id2}/DataBindings/{uuid}.json              (its data binding)
RelationshipTypes/{rid}/definition.json                 (relationship definition)
RelationshipTypes/{rid}/Contextualizations/{uuid}.json  (relationship binding)
```

---

## Impact on Notebook 09

The existing `src/notebooks/09_data_binding.ipynb` needs these changes:

1. **Fix getDefinition LRO pattern**: Use `{operationUrl}/result` instead of re-calling `getDefinition`
2. **Keep IDs as strings**: The notebook has `entity_id = int(entity_id)` which converts back to integer — REMOVE this
3. **Use `sourceSchema: "dbo"`**: Confirm this is set correctly
4. **Include all existing parts in upload**: When adding bindings, upload all entity type definitions alongside the new binding parts
5. **Add `$schema` to payloads**: While not strictly required for upload (Fabric adds it), including it may improve compatibility

---

## Verified Environment

- **Workspace:** `ws-rdf_translation-dev-01` (`52fc996f-ca95-4e33-9f60-7f5f47cdf8a5`)
- **Lakehouse:** `lh_rdf_translation_dev_01` (`32e17923-0b8b-4106-953a-6d63081fa361`)
- **Table used:** `gold_nodes` (column `id`), `gold_edges` (columns `source_id`, `target_id`)
- **Auth:** Azure CLI token for `https://api.fabric.microsoft.com`
- **API version:** v1

---

## Research Script Usage

```bash
# Run all tests
python research/data_binding_research.py

# Run specific tests
python research/data_binding_research.py --test 1,3
python research/data_binding_research.py --test 5
python research/data_binding_research.py --test 8  # Interactive UI inspection
```
