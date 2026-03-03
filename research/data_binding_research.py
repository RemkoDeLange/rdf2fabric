"""
Fabric Ontology Data Binding Research Script
=============================================
Fast-iteration research to discover how data binding works with the Fabric Ontology API.
Each test creates fresh ontologies, tests bindings, and cleans up.

Run from terminal: python research/data_binding_research.py
                   python research/data_binding_research.py --test 3  (run single test)
                   python research/data_binding_research.py --test 1,2,3  (run specific tests)

Prerequisites:
  - az login (Azure CLI logged in)
  - pip install requests
"""

import requests
import json
import base64
import subprocess
import time
import uuid
import sys
import traceback
from datetime import datetime
from typing import Optional, Dict, List, Any

# ============================================================================
# CONFIG
# ============================================================================
WORKSPACE_NAME = "ws-rdf_translation-dev-01"  # Will discover ID
FABRIC_API = "https://api.fabric.microsoft.com/v1"
LRO_POLL_SEC = 3
LRO_TIMEOUT_SEC = 180
VERBOSE = True

# ============================================================================
# UTILITIES
# ============================================================================
class Colors:
    OK = "\033[92m"
    FAIL = "\033[91m"
    WARN = "\033[93m"
    INFO = "\033[94m"
    BOLD = "\033[1m"
    END = "\033[0m"

def log(msg, level="INFO"):
    ts = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    color = {"OK": Colors.OK, "FAIL": Colors.FAIL, "WARN": Colors.WARN, "INFO": Colors.INFO}.get(level, "")
    print(f"{color}[{ts}] [{level}] {msg}{Colors.END}")

def log_json(label, obj, max_chars=1000):
    if VERBOSE:
        s = json.dumps(obj, indent=2)
        if len(s) > max_chars:
            s = s[:max_chars] + f"\n... ({len(s)} chars total)"
        log(f"{label}:\n{s}")


class FabricAPI:
    """Lightweight Fabric REST API client using Azure CLI tokens."""
    
    def __init__(self):
        self.token = self._get_token()
        self.workspace_id = None
        self.lakehouse_id = None
        self.lakehouse_name = None
    
    def _get_token(self):
        result = subprocess.run(
            "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
            capture_output=True, text=True, shell=True
        )
        if result.returncode != 0:
            raise Exception(f"Token error: {result.stderr}")
        return result.stdout.strip()
    
    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def get(self, endpoint, params=None):
        url = f"{FABRIC_API}/{endpoint}"
        if VERBOSE:
            log(f"GET {endpoint}")
        return requests.get(url, headers=self.headers, params=params, timeout=60)
    
    def post(self, endpoint, data=None):
        url = f"{FABRIC_API}/{endpoint}"
        if VERBOSE:
            log(f"POST {endpoint}")
        return requests.post(url, headers=self.headers, json=data or {}, timeout=120)
    
    def delete(self, endpoint):
        url = f"{FABRIC_API}/{endpoint}"
        if VERBOSE:
            log(f"DELETE {endpoint}")
        return requests.delete(url, headers=self.headers, timeout=60)
    
    def wait_lro(self, resp, label="operation"):
        """Handle LRO from a response that returned 202."""
        log(f"wait_lro: status={resp.status_code}, headers={dict(resp.headers)}")
        if resp.status_code == 200:
            return resp.json() if resp.text else {}
        if resp.status_code == 201:
            return resp.json() if resp.text else {}
        if resp.status_code != 202:
            log(f"wait_lro: unexpected status {resp.status_code} body={resp.text[:300]}", "WARN")
            return None
        
        op_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        retry_after = int(resp.headers.get("Retry-After", "2"))
        if not op_url:
            log(f"202 but no LRO URL for {label}. Retry-After={retry_after}", "WARN")
            # Some 202 responses don't have Location header - just wait and return
            time.sleep(max(retry_after, 5))
            return {"status": "Completed"}
        
        log(f"LRO started for {label}...")
        start = time.time()
        while time.time() - start < LRO_TIMEOUT_SEC:
            time.sleep(LRO_POLL_SEC)
            r = requests.get(op_url, headers=self.headers, timeout=60)
            if r.status_code != 200:
                log(f"LRO poll error: {r.status_code} {r.text[:200]}", "WARN")
                continue
            result = r.json()
            status = result.get("status", "Unknown")
            if status in ["Succeeded", "Completed"]:
                log(f"LRO {label}: {status}", "OK")
                return result
            elif status in ["Failed", "Cancelled"]:
                error = result.get("error", {})
                log(f"LRO {label} FAILED: {error}", "FAIL")
                return result
            else:
                elapsed = int(time.time() - start)
                log(f"LRO {label}: {status} ({elapsed}s)")
        
        log(f"LRO {label} timed out after {LRO_TIMEOUT_SEC}s", "FAIL")
        return {"status": "Timeout"}

    def get_definition(self, ontology_id: str) -> Optional[dict]:
        """Get ontology definition, properly handling the LRO → /result pattern.
        
        The Fabric getDefinition endpoint always returns 202 (LRO).
        After the LRO succeeds, the actual definition is at {operationUrl}/result.
        """
        resp = self.post(f"workspaces/{self.workspace_id}/ontologies/{ontology_id}/getDefinition", {})
        
        if resp.status_code == 200:
            return resp.json()
        
        if resp.status_code != 202:
            log(f"getDefinition unexpected status: {resp.status_code} {resp.text[:200]}", "FAIL")
            return None
        
        # Handle LRO
        op_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        if not op_url:
            log("getDefinition 202 but no LRO URL", "FAIL")
            return None
        
        log("getDefinition LRO started...")
        start = time.time()
        lro_succeeded = False
        while time.time() - start < LRO_TIMEOUT_SEC:
            time.sleep(LRO_POLL_SEC)
            r = requests.get(op_url, headers=self.headers, timeout=60)
            if r.status_code != 200:
                log(f"getDefinition LRO poll error: {r.status_code}", "WARN")
                continue
            result = r.json()
            status = result.get("status", "Unknown")
            if status in ["Succeeded", "Completed"]:
                log(f"getDefinition LRO: {status}", "OK")
                lro_succeeded = True
                break
            elif status in ["Failed", "Cancelled"]:
                log(f"getDefinition LRO FAILED: {result.get('error', {})}", "FAIL")
                return None
            else:
                elapsed = int(time.time() - start)
                log(f"getDefinition LRO: {status} ({elapsed}s)")
        
        if not lro_succeeded:
            log("getDefinition LRO timed out", "FAIL")
            return None
        
        # Try the /result endpoint (Fabric LRO pattern for getDefinition)
        result_url = f"{op_url}/result"
        log(f"Fetching definition from LRO result URL...")
        r = requests.get(result_url, headers=self.headers, timeout=60)
        if r.status_code == 200:
            log("Got definition from LRO /result", "OK")
            return r.json()
        
        log(f"LRO /result returned {r.status_code}: {r.text[:300]}", "WARN")
        
        # Fallback: try POST getDefinition again (race condition workaround)
        time.sleep(3)
        resp2 = self.post(f"workspaces/{self.workspace_id}/ontologies/{ontology_id}/getDefinition", {})
        if resp2.status_code == 200:
            return resp2.json()
        
        log(f"getDefinition still returns {resp2.status_code} after LRO", "FAIL")
        return None


def b64(data: dict) -> str:
    """Base64 encode a dict as JSON."""
    return base64.b64encode(json.dumps(data).encode()).decode()

def b64_decode(payload: str) -> dict:
    """Decode a base64 JSON payload."""
    return json.loads(base64.b64decode(payload).decode())


# ============================================================================
# TEST 1: Discover workspace and lakehouse IDs
# ============================================================================
def test_1_discover_ids(api: FabricAPI) -> bool:
    log(f"{Colors.BOLD}TEST 1: Discover workspace and lakehouse IDs{Colors.END}")
    
    # Find workspace
    resp = api.get("workspaces")
    if resp.status_code != 200:
        log(f"Cannot list workspaces: {resp.status_code}", "FAIL")
        return False
    
    workspaces = resp.json().get("value", [])
    for ws in workspaces:
        if ws["displayName"] == WORKSPACE_NAME or "rdf_translation" in ws["displayName"].lower():
            api.workspace_id = ws["id"]
            log(f"Workspace: {ws['displayName']} → {ws['id']}", "OK")
            break
    
    if not api.workspace_id:
        log(f"Workspace '{WORKSPACE_NAME}' not found. Available:", "FAIL")
        for ws in workspaces:
            log(f"  - {ws['displayName']}")
        return False
    
    # Find lakehouse
    resp = api.get(f"workspaces/{api.workspace_id}/lakehouses")
    if resp.status_code == 200:
        lakehouses = resp.json().get("value", [])
        for lh in lakehouses:
            log(f"  Lakehouse: {lh['displayName']} → {lh['id']}")
            if "rdf_translation" in lh["displayName"].lower():
                api.lakehouse_id = lh["id"]
                api.lakehouse_name = lh["displayName"]
                log(f"Using lakehouse: {lh['displayName']} → {lh['id']}", "OK")
    else:
        log(f"Cannot list lakehouses: {resp.status_code} {resp.text[:200]}", "WARN")
    
    # List existing ontologies  
    resp = api.get(f"workspaces/{api.workspace_id}/ontologies")
    if resp.status_code == 200:
        ontologies = resp.json().get("value", [])
        log(f"Existing ontologies ({len(ontologies)}):")
        for ont in ontologies:
            log(f"  - {ont['displayName']} ({ont['id']})")
    
    # List tables in lakehouse (via SQL endpoint or just list items)
    if api.lakehouse_id:
        resp = api.get(f"workspaces/{api.workspace_id}/lakehouses/{api.lakehouse_id}/tables")
        if resp.status_code == 200:
            tables = resp.json().get("data", [])
            log(f"Lakehouse tables ({len(tables)}):")
            for t in tables:
                log(f"  - {t.get('name', t)}")
        else:
            log(f"Tables endpoint: {resp.status_code} (may need different API)", "WARN")
    
    return api.workspace_id is not None


# ============================================================================
# TEST 2: Create ontology, upload entity types, verify
# ============================================================================
def test_2_create_ontology_with_entities(api: FabricAPI) -> Optional[str]:
    """Create a test ontology with 2 entity types. Returns ontology_id on success."""
    log(f"{Colors.BOLD}TEST 2: Create ontology with entity types{Colors.END}")
    
    test_name = f"ResearchBinding{datetime.now().strftime('%H%M%S')}"
    
    # Step 1: Create ontology item
    resp = api.post(f"workspaces/{api.workspace_id}/ontologies", {
        "displayName": test_name,
        "description": "Data binding research - safe to delete"
    })
    
    result = api.wait_lro(resp, "create ontology")
    
    # Find the created ontology (retry a few times - LRO may still be propagating)
    ontology_id = None
    for attempt in range(5):
        resp = api.get(f"workspaces/{api.workspace_id}/ontologies")
        ontologies = resp.json().get("value", [])
        for ont in ontologies:
            if ont["displayName"] == test_name:
                ontology_id = ont["id"]
                break
        if ontology_id:
            break
        log(f"Ontology not found yet (attempt {attempt+1}/5), waiting...")
        time.sleep(3)
    
    if not ontology_id:
        log(f"Could not find created ontology '{test_name}'. Available: {[o['displayName'] for o in ontologies]}", "FAIL")
        return None
    
    log(f"Created ontology: {ontology_id}", "OK")
    
    # Step 2: Upload entity types
    # Equipment entity with 2 properties
    equipment_id = "1001001001001"
    equip_name_prop_id = "2001001001001"
    equip_uri_prop_id = "3001001001001"
    
    equipment = {
        "id": equipment_id,
        "namespace": "research",
        "name": "Equipment",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "baseEntityTypeId": None,
        "entityIdParts": [equip_uri_prop_id],
        "displayNamePropertyId": equip_name_prop_id,
        "properties": [
            {
                "id": equip_uri_prop_id,
                "name": "uri",
                "valueType": "String",
                "redefines": None,
                "baseTypeNamespaceType": None
            },
            {
                "id": equip_name_prop_id,
                "name": "DisplayName",
                "valueType": "String",
                "redefines": None,
                "baseTypeNamespaceType": None
            }
        ],
        "timeseriesProperties": []
    }
    
    # Location entity
    location_id = "4001001001001"
    loc_name_prop_id = "5001001001001"
    loc_uri_prop_id = "6001001001001"
    
    location = {
        "id": location_id,
        "namespace": "research",
        "name": "Location",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "baseEntityTypeId": None,
        "entityIdParts": [loc_uri_prop_id],
        "displayNamePropertyId": loc_name_prop_id,
        "properties": [
            {
                "id": loc_uri_prop_id,
                "name": "uri",
                "valueType": "String",
                "redefines": None,
                "baseTypeNamespaceType": None
            },
            {
                "id": loc_name_prop_id,
                "name": "DisplayName",
                "valueType": "String",
                "redefines": None,
                "baseTypeNamespaceType": None
            }
        ],
        "timeseriesProperties": []
    }
    
    # Relationship: Equipment --locatedAt--> Location
    rel_id = "7001001001001"
    relationship = {
        "id": rel_id,
        "namespace": "research",
        "name": "locatedAt",
        "namespaceType": "Custom",
        "source": {"entityTypeId": equipment_id},
        "target": {"entityTypeId": location_id}
    }
    
    parts = [
        {"path": ".platform", "payload": b64({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
            "metadata": {"type": "Ontology", "displayName": test_name},
            "config": {"version": "2.0", "logicalId": ontology_id}
        }), "payloadType": "InlineBase64"},
        {"path": "definition.json", "payload": b64({}), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{equipment_id}/definition.json", "payload": b64(equipment), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{location_id}/definition.json", "payload": b64(location), "payloadType": "InlineBase64"},
        {"path": f"RelationshipTypes/{rel_id}/definition.json", "payload": b64(relationship), "payloadType": "InlineBase64"},
    ]
    
    log(f"Uploading {len(parts)} definition parts...")
    resp = api.post(
        f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": parts}}
    )
    
    result = api.wait_lro(resp, "upload entity types")
    if result and result.get("status") in ["Succeeded", "Completed"]:
        log("Entity types uploaded successfully!", "OK")
    else:
        log(f"Entity type upload result: {result}", "FAIL")
        # Cleanup
        api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
        return None
    
    # Step 3: Verify by reading back definition
    time.sleep(2)  # Small delay before reading back
    definition = api.get_definition(ontology_id)
    if definition:
        parts_back = definition.get("definition", {}).get("parts", [])
        entity_count = sum(1 for p in parts_back if "EntityTypes/" in p.get("path", "") and p["path"].endswith("/definition.json"))
        rel_count = sum(1 for p in parts_back if "RelationshipTypes/" in p.get("path", "") and p["path"].endswith("/definition.json"))
        log(f"Read back: {entity_count} entities, {rel_count} relationships", "OK")
        
        # Show all paths
        for p in parts_back:
            path = p.get("path", "")
            log(f"  Part: {path}")
            if "EntityTypes/" in path and path.endswith("/definition.json"):
                content = b64_decode(p["payload"])
                log(f"    Entity: {content.get('name')} (id={content.get('id')}, type={type(content.get('id')).__name__})")
    
    return ontology_id


# ============================================================================
# TEST 3: Minimal data binding - single entity, single property
# ============================================================================
def test_3_minimal_binding(api: FabricAPI, ontology_id: str = None) -> bool:
    """Test the absolute minimum data binding payload."""
    log(f"{Colors.BOLD}TEST 3: Minimal data binding (1 entity, 1 property){Colors.END}")
    
    if not api.lakehouse_id:
        log("No lakehouse ID - skipping", "WARN")
        return False
    
    # If no ontology provided, create fresh
    own_ontology = False
    if not ontology_id:
        ontology_id = test_2_create_ontology_with_entities(api)
        own_ontology = True
        if not ontology_id:
            return False
    
    # Step 1: Read back the entity definition to get exact IDs
    time.sleep(2)
    definition = api.get_definition(ontology_id)
    if not definition:
        log("Cannot read definition", "FAIL")
        return False
    
    existing_parts = definition.get("definition", {}).get("parts", [])
    
    # Find the Equipment entity and its uri property ID
    entity_id = None
    uri_prop_id = None
    entity_name = None
    
    for part in existing_parts:
        path = part.get("path", "")
        if "EntityTypes/" in path and path.endswith("/definition.json"):
            content = b64_decode(part["payload"])
            if content.get("name") == "Equipment":
                entity_id = str(content["id"])  # Ensure string
                entity_name = content["name"]
                for prop in content.get("properties", []):
                    if prop["name"] == "uri":
                        uri_prop_id = str(prop["id"])
                        break
                break
    
    if not entity_id or not uri_prop_id:
        log("Could not find Equipment entity or uri property", "FAIL")
        return False
    
    log(f"Binding Equipment (id={entity_id}) uri property (id={uri_prop_id})")
    
    # Step 2: Build binding definition
    # Based on Microsoft docs sample:
    # https://learn.microsoft.com/en-us/rest/api/fabric/ontology/items/update-ontology-definition
    binding_uuid = str(uuid.uuid4())
    
    binding = {
        "id": binding_uuid,
        "dataBindingConfiguration": {
            "dataBindingType": "NonTimeSeries",
            "propertyBindings": [
                {
                    "sourceColumnName": "id",  # Column in gold_nodes
                    "targetPropertyId": uri_prop_id  # Maps to uri property
                }
            ],
            "sourceTableProperties": {
                "sourceType": "LakehouseTable",
                "workspaceId": api.workspace_id,
                "itemId": api.lakehouse_id,
                "sourceTableName": "gold_nodes",
                "sourceSchema": "dbo"
            }
        }
    }
    
    log_json("Binding payload", binding)
    
    # Step 3: Build the update with ONLY the binding (include existing entity types too)
    # Key question: Do we need to include all entity type definitions again, or just the binding?
    
    # APPROACH A: Include entity types + binding in same updateDefinition
    update_parts = list(existing_parts)  # Keep all existing parts
    
    # Add the data binding part
    binding_path = f"EntityTypes/{entity_id}/DataBindings/{binding_uuid}.json"
    update_parts.append({
        "path": binding_path,
        "payload": b64(binding),
        "payloadType": "InlineBase64"
    })
    
    log(f"Uploading {len(update_parts)} parts (existing + 1 binding)")
    log(f"Binding path: {binding_path}")
    
    resp = api.post(
        f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": update_parts}}
    )
    
    log(f"Response: {resp.status_code}")
    if resp.status_code in [200, 201]:
        log("Data binding uploaded SYNC!", "OK")
        return True
    elif resp.status_code == 202:
        result = api.wait_lro(resp, "upload binding")
        if result and result.get("status") in ["Succeeded", "Completed"]:
            log("Data binding uploaded!", "OK")
            return True
        else:
            log(f"Binding upload failed: {result}", "FAIL")
            # Try to get more error details
            error = result.get("error", {}) if result else {}
            log_json("Error details", error)
            return False
    else:
        log(f"Binding upload error: {resp.status_code}", "FAIL")
        log(f"Response body: {resp.text[:500]}")
        return False


# ============================================================================
# TEST 4: Try different binding structures
# ============================================================================
def test_4_binding_variations(api: FabricAPI) -> dict:
    """Try multiple binding payload variations to find what works."""
    log(f"{Colors.BOLD}TEST 4: Binding structure variations{Colors.END}")
    
    results = {}
    
    if not api.lakehouse_id:
        log("No lakehouse ID - skipping", "WARN")
        return results
    
    # Create fresh ontology for each variation
    variations = {
        "A_minimal_binding_only": {
            # Only binding parts, no entity type definitions
            "include_entities": False,
            "binding_format": "standard"
        },
        "B_entities_plus_binding": {
            # Entity types + binding in same call
            "include_entities": True,
            "binding_format": "standard"
        },
        "C_string_ids_in_binding": {
            # All IDs as strings in binding
            "include_entities": True,
            "binding_format": "string_ids"
        },
        "D_no_source_schema": {
            # omit sourceSchema field
            "include_entities": True,
            "binding_format": "no_schema"
        },
        "E_lakehouse_source_type": {
            # Try "Lakehouse" instead of "LakehouseTable" 
            "include_entities": True,
            "binding_format": "lakehouse_type"
        },
    }
    
    for var_name, var_config in variations.items():
        log(f"\n--- Variation {var_name} ---")
        
        test_name = f"Research{var_name}_{datetime.now().strftime('%H%M%S')}"
        
        # Create ontology
        resp = api.post(f"workspaces/{api.workspace_id}/ontologies", {
            "displayName": test_name,
            "description": f"Research variation {var_name}"
        })
        api.wait_lro(resp, f"create {var_name}")
        
        # Find it
        resp = api.get(f"workspaces/{api.workspace_id}/ontologies")
        ontology_id = None
        for ont in resp.json().get("value", []):
            if ont["displayName"] == test_name:
                ontology_id = ont["id"]
                break
        
        if not ontology_id:
            results[var_name] = "FAIL: Could not create ontology"
            continue
        
        # Upload entity types first
        entity_id = "1001001001001"
        uri_prop_id = "3001001001001"
        name_prop_id = "2001001001001"
        
        entity = {
            "id": entity_id, "namespace": "research", "name": "TestEntity",
            "namespaceType": "Custom", "visibility": "Visible",
            "baseEntityTypeId": None,
            "entityIdParts": [uri_prop_id],
            "displayNamePropertyId": name_prop_id,
            "properties": [
                {"id": uri_prop_id, "name": "uri", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None},
                {"id": name_prop_id, "name": "DisplayName", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None}
            ],
            "timeseriesProperties": []
        }
        
        entity_parts = [
            {"path": ".platform", "payload": b64({"metadata": {"type": "Ontology", "displayName": test_name}}), "payloadType": "InlineBase64"},
            {"path": "definition.json", "payload": b64({}), "payloadType": "InlineBase64"},
            {"path": f"EntityTypes/{entity_id}/definition.json", "payload": b64(entity), "payloadType": "InlineBase64"},
        ]
        
        resp = api.post(
            f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
            {"definition": {"parts": entity_parts}}
        )
        entity_result = api.wait_lro(resp, f"upload entity for {var_name}")
        
        if not entity_result or entity_result.get("status") not in ["Succeeded", "Completed"]:
            results[var_name] = f"FAIL: Entity upload failed: {entity_result}"
            api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
            continue
        
        time.sleep(2)
        
        # Now try the binding variation
        binding_uuid = str(uuid.uuid4())
        
        # Build binding based on variation
        fmt = var_config["binding_format"]
        
        if fmt == "standard":
            binding = {
                "id": binding_uuid,
                "dataBindingConfiguration": {
                    "dataBindingType": "NonTimeSeries",
                    "propertyBindings": [
                        {"sourceColumnName": "id", "targetPropertyId": uri_prop_id}
                    ],
                    "sourceTableProperties": {
                        "sourceType": "LakehouseTable",
                        "workspaceId": api.workspace_id,
                        "itemId": api.lakehouse_id,
                        "sourceTableName": "gold_nodes",
                        "sourceSchema": "dbo"
                    }
                }
            }
        elif fmt == "string_ids":
            binding = {
                "id": binding_uuid,
                "dataBindingConfiguration": {
                    "dataBindingType": "NonTimeSeries",
                    "propertyBindings": [
                        {"sourceColumnName": "id", "targetPropertyId": str(uri_prop_id)}
                    ],
                    "sourceTableProperties": {
                        "sourceType": "LakehouseTable",
                        "workspaceId": str(api.workspace_id),
                        "itemId": str(api.lakehouse_id),
                        "sourceTableName": "gold_nodes",
                        "sourceSchema": "dbo"
                    }
                }
            }
        elif fmt == "no_schema":
            binding = {
                "id": binding_uuid,
                "dataBindingConfiguration": {
                    "dataBindingType": "NonTimeSeries",
                    "propertyBindings": [
                        {"sourceColumnName": "id", "targetPropertyId": uri_prop_id}
                    ],
                    "sourceTableProperties": {
                        "sourceType": "LakehouseTable",
                        "workspaceId": api.workspace_id,
                        "itemId": api.lakehouse_id,
                        "sourceTableName": "gold_nodes"
                    }
                }
            }
        elif fmt == "lakehouse_type":
            binding = {
                "id": binding_uuid,
                "dataBindingConfiguration": {
                    "dataBindingType": "NonTimeSeries",
                    "propertyBindings": [
                        {"sourceColumnName": "id", "targetPropertyId": uri_prop_id}
                    ],
                    "sourceTableProperties": {
                        "sourceType": "Lakehouse",
                        "workspaceId": api.workspace_id,
                        "itemId": api.lakehouse_id,
                        "sourceTableName": "gold_nodes",
                        "sourceSchema": "dbo"
                    }
                }
            }
        
        log_json(f"Binding {var_name}", binding)
        
        # Build update parts
        update_parts = []
        
        if var_config["include_entities"]:
            # Read back existing definition  
            def_result = api.get_definition(ontology_id)
            if def_result:
                update_parts = def_result.get("definition", {}).get("parts", [])
            else:
                update_parts = list(entity_parts)
        else:
            # Only .platform and definition.json + binding
            update_parts = [
                {"path": ".platform", "payload": b64({"metadata": {"type": "Ontology", "displayName": test_name}}), "payloadType": "InlineBase64"},
                {"path": "definition.json", "payload": b64({}), "payloadType": "InlineBase64"},
            ]
        
        # Add binding
        update_parts.append({
            "path": f"EntityTypes/{entity_id}/DataBindings/{binding_uuid}.json",
            "payload": b64(binding),
            "payloadType": "InlineBase64"
        })
        
        resp = api.post(
            f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
            {"definition": {"parts": update_parts}}
        )
        
        if resp.status_code in [200, 201]:
            results[var_name] = "SUCCESS (sync)"
            log(f"*** {var_name}: SUCCESS (sync) ***", "OK")
        elif resp.status_code == 202:
            lro_result = api.wait_lro(resp, f"binding {var_name}")
            if lro_result and lro_result.get("status") in ["Succeeded", "Completed"]:
                results[var_name] = "SUCCESS"
                log(f"*** {var_name}: SUCCESS ***", "OK")
            else:
                error = lro_result.get("error", {}) if lro_result else {}
                results[var_name] = f"FAIL: {error.get('errorCode', 'Unknown')} - {error.get('message', str(lro_result))}"
                log(f"*** {var_name}: FAILED ***", "FAIL")
                log_json("Error", error)
        else:
            results[var_name] = f"FAIL: HTTP {resp.status_code} - {resp.text[:200]}"
            log(f"*** {var_name}: HTTP ERROR ***", "FAIL")
        
        # Cleanup
        api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
        time.sleep(2)
    
    # Summary
    log(f"\n{Colors.BOLD}=== VARIATION RESULTS ==={Colors.END}")
    for name, result in results.items():
        status = "OK" if "SUCCESS" in result else "FAIL"
        log(f"  {name}: {result}", status)
    
    return results


# ============================================================================
# TEST 5: Relationship contextualization binding
# ============================================================================
def test_5_relationship_binding(api: FabricAPI) -> bool:
    """Test relationship contextualization binding."""
    log(f"{Colors.BOLD}TEST 5: Relationship binding / contextualization{Colors.END}")
    
    if not api.lakehouse_id:
        log("No lakehouse ID - skipping", "WARN")
        return False
    
    test_name = f"ResearchRelBind_{datetime.now().strftime('%H%M%S')}"
    
    # Create ontology + entities + relationship
    resp = api.post(f"workspaces/{api.workspace_id}/ontologies", {
        "displayName": test_name,
        "description": "Relationship binding research"
    })
    api.wait_lro(resp, "create ontology")
    
    resp = api.get(f"workspaces/{api.workspace_id}/ontologies")
    ontology_id = None
    for ont in resp.json().get("value", []):
        if ont["displayName"] == test_name:
            ontology_id = ont["id"]
            break
    
    if not ontology_id:
        log("Could not create ontology", "FAIL")
        return False
    
    # Entity IDs
    equip_id = "1001001001001"
    equip_uri_prop = "3001001001001"
    equip_name_prop = "2001001001001"
    loc_id = "4001001001001"
    loc_uri_prop = "6001001001001"
    loc_name_prop = "5001001001001"
    rel_id = "7001001001001"
    
    equipment = {
        "id": equip_id, "namespace": "research", "name": "Equipment",
        "namespaceType": "Custom", "visibility": "Visible",
        "baseEntityTypeId": None,
        "entityIdParts": [equip_uri_prop],
        "displayNamePropertyId": equip_name_prop,
        "properties": [
            {"id": equip_uri_prop, "name": "uri", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None},
            {"id": equip_name_prop, "name": "DisplayName", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None}
        ],
        "timeseriesProperties": []
    }
    
    location = {
        "id": loc_id, "namespace": "research", "name": "Location",
        "namespaceType": "Custom", "visibility": "Visible",
        "baseEntityTypeId": None,
        "entityIdParts": [loc_uri_prop],
        "displayNamePropertyId": loc_name_prop,
        "properties": [
            {"id": loc_uri_prop, "name": "uri", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None},
            {"id": loc_name_prop, "name": "DisplayName", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None}
        ],
        "timeseriesProperties": []
    }
    
    rel = {
        "id": rel_id, "namespace": "research", "name": "locatedAt",
        "namespaceType": "Custom",
        "source": {"entityTypeId": equip_id},
        "target": {"entityTypeId": loc_id}
    }
    
    # Upload entities + relationship
    parts = [
        {"path": ".platform", "payload": b64({"metadata": {"type": "Ontology", "displayName": test_name}}), "payloadType": "InlineBase64"},
        {"path": "definition.json", "payload": b64({}), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{equip_id}/definition.json", "payload": b64(equipment), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{loc_id}/definition.json", "payload": b64(location), "payloadType": "InlineBase64"},
        {"path": f"RelationshipTypes/{rel_id}/definition.json", "payload": b64(rel), "payloadType": "InlineBase64"},
    ]
    
    resp = api.post(
        f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": parts}}
    )
    result = api.wait_lro(resp, "upload entities + rel")
    if not result or result.get("status") not in ["Succeeded", "Completed"]:
        log(f"Entity upload failed: {result}", "FAIL")
        api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
        return False
    
    time.sleep(2)
    
    # Read back definition
    def_result = api.get_definition(ontology_id)
    existing_parts = def_result.get("definition", {}).get("parts", []) if def_result else parts
    
    # Now try BOTH entity binding AND relationship contextualization
    entity_binding_uuid = str(uuid.uuid4())
    entity_binding = {
        "id": entity_binding_uuid,
        "dataBindingConfiguration": {
            "dataBindingType": "NonTimeSeries",
            "propertyBindings": [
                {"sourceColumnName": "id", "targetPropertyId": equip_uri_prop}
            ],
            "sourceTableProperties": {
                "sourceType": "LakehouseTable",
                "workspaceId": api.workspace_id,
                "itemId": api.lakehouse_id,
                "sourceTableName": "gold_nodes",
                "sourceSchema": "dbo"
            }
        }
    }
    
    loc_binding_uuid = str(uuid.uuid4())
    loc_binding = {
        "id": loc_binding_uuid,
        "dataBindingConfiguration": {
            "dataBindingType": "NonTimeSeries",
            "propertyBindings": [
                {"sourceColumnName": "id", "targetPropertyId": loc_uri_prop}
            ],
            "sourceTableProperties": {
                "sourceType": "LakehouseTable",
                "workspaceId": api.workspace_id,
                "itemId": api.lakehouse_id,
                "sourceTableName": "gold_nodes",
                "sourceSchema": "dbo"
            }
        }
    }
    
    rel_binding_uuid = str(uuid.uuid4())
    rel_contextualization = {
        "id": rel_binding_uuid,
        "dataBindingTable": {
            "sourceType": "LakehouseTable",
            "workspaceId": api.workspace_id,
            "itemId": api.lakehouse_id,
            "sourceTableName": "gold_edges",
            "sourceSchema": "dbo"
        },
        "sourceKeyRefBindings": [
            {"sourceColumnName": "source_id", "targetPropertyId": equip_uri_prop}
        ],
        "targetKeyRefBindings": [
            {"sourceColumnName": "target_id", "targetPropertyId": loc_uri_prop}
        ]
    }
    
    log_json("Entity binding (Equipment)", entity_binding)
    log_json("Relationship contextualization", rel_contextualization)
    
    # Build full update
    update_parts = list(existing_parts)
    update_parts.append({
        "path": f"EntityTypes/{equip_id}/DataBindings/{entity_binding_uuid}.json",
        "payload": b64(entity_binding),
        "payloadType": "InlineBase64"
    })
    update_parts.append({
        "path": f"EntityTypes/{loc_id}/DataBindings/{loc_binding_uuid}.json",
        "payload": b64(loc_binding),
        "payloadType": "InlineBase64"
    })
    update_parts.append({
        "path": f"RelationshipTypes/{rel_id}/Contextualizations/{rel_binding_uuid}.json",
        "payload": b64(rel_contextualization),
        "payloadType": "InlineBase64"
    })
    
    log(f"Uploading {len(update_parts)} parts (entities + bindings + rel contextualization)")
    
    resp = api.post(
        f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": update_parts}}
    )
    
    success = False
    if resp.status_code in [200, 201]:
        log("Full binding uploaded SYNC!", "OK")
        success = True
    elif resp.status_code == 202:
        result = api.wait_lro(resp, "full binding upload")
        if result and result.get("status") in ["Succeeded", "Completed"]:
            log("Full binding (entity + rel) uploaded!", "OK")
            success = True
        else:
            log(f"Full binding failed: {result}", "FAIL")
            error = result.get("error", {}) if result else {}
            log_json("Error", error)
    else:
        log(f"HTTP error: {resp.status_code} {resp.text[:500]}", "FAIL")
    
    # Read back to see what was stored
    if success:
        time.sleep(2)
        def_result = api.get_definition(ontology_id)
        if def_result:
            final_parts = def_result.get("definition", {}).get("parts", [])
            log(f"Final definition has {len(final_parts)} parts:")
            for p in final_parts:
                log(f"  {p.get('path', '')}")
                if "DataBindings/" in p.get("path", ""):
                    content = b64_decode(p["payload"])
                    log_json("  Stored binding", content)
                elif "Contextualizations/" in p.get("path", ""):
                    content = b64_decode(p["payload"])
                    log_json("  Stored contextualization", content)
    
    # Cleanup
    api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
    
    return success


# ============================================================================
# TEST 6: Binding with real gold_nodes table (check columns exist)
# ============================================================================
def test_6_real_table_binding(api: FabricAPI) -> bool:
    """Test binding against actual gold_nodes/gold_edges tables."""
    log(f"{Colors.BOLD}TEST 6: Binding with actual Lakehouse tables{Colors.END}")
    
    if not api.lakehouse_id:
        log("No lakehouse ID - skipping", "WARN")
        return False
    
    # First, let's check what tables exist via the Lakehouse API
    resp = api.get(f"workspaces/{api.workspace_id}/lakehouses/{api.lakehouse_id}/tables")
    if resp.status_code == 200:
        tables = resp.json().get("data", [])
        log(f"Tables in lakehouse:")
        for t in tables:
            name = t.get("name", str(t))
            fmt = t.get("format", "unknown")
            log(f"  - {name} (format: {fmt})")
    else:
        log(f"Cannot list tables (API: {resp.status_code}); proceeding anyway", "WARN")
    
    # Create fresh ontology with entity types matching the gold data
    test_name = f"ResearchRealData_{datetime.now().strftime('%H%M%S')}"
    resp = api.post(f"workspaces/{api.workspace_id}/ontologies", {
        "displayName": test_name,
        "description": "Real table binding research"
    })
    api.wait_lro(resp, "create ontology")
    
    resp = api.get(f"workspaces/{api.workspace_id}/ontologies")
    ontology_id = None
    for ont in resp.json().get("value", []):
        if ont["displayName"] == test_name:
            ontology_id = ont["id"]
            break
    
    if not ontology_id:
        log("Could not create ontology", "FAIL")
        return False
    
    # Single entity type with just 'id' as uri
    entity_id = "9001001001001"
    uri_prop_id = "9002001001001"
    
    entity = {
        "id": entity_id,
        "namespace": "research",
        "name": "GenericNode",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "baseEntityTypeId": None,
        "entityIdParts": [uri_prop_id],
        "displayNamePropertyId": uri_prop_id,
        "properties": [
            {"id": uri_prop_id, "name": "nodeId", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None}
        ],
        "timeseriesProperties": []
    }
    
    parts = [
        {"path": ".platform", "payload": b64({"metadata": {"type": "Ontology", "displayName": test_name}}), "payloadType": "InlineBase64"},
        {"path": "definition.json", "payload": b64({}), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{entity_id}/definition.json", "payload": b64(entity), "payloadType": "InlineBase64"},
    ]
    
    resp = api.post(
        f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": parts}}
    )
    result = api.wait_lro(resp, "upload entity")
    if not result or result.get("status") not in ["Succeeded", "Completed"]:
        log(f"Entity upload failed: {result}", "FAIL")
        api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
        return False
    
    time.sleep(2)
    
    # Read back
    def_result = api.get_definition(ontology_id)
    existing_parts = def_result.get("definition", {}).get("parts", []) if def_result else parts
    
    # Try binding to gold_nodes with column "id"
    binding_uuid = str(uuid.uuid4())
    binding = {
        "id": binding_uuid,
        "dataBindingConfiguration": {
            "dataBindingType": "NonTimeSeries",
            "propertyBindings": [
                {"sourceColumnName": "id", "targetPropertyId": uri_prop_id}
            ],
            "sourceTableProperties": {
                "sourceType": "LakehouseTable",
                "workspaceId": api.workspace_id,
                "itemId": api.lakehouse_id,
                "sourceTableName": "gold_nodes",
                "sourceSchema": "dbo"
            }
        }
    }
    
    update_parts = list(existing_parts)
    update_parts.append({
        "path": f"EntityTypes/{entity_id}/DataBindings/{binding_uuid}.json",
        "payload": b64(binding),
        "payloadType": "InlineBase64"
    })
    
    resp = api.post(
        f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": update_parts}}
    )
    
    success = False
    if resp.status_code == 202:
        result = api.wait_lro(resp, "real table binding")
        if result and result.get("status") in ["Succeeded", "Completed"]:
            log("Real table binding SUCCESS!", "OK")
            success = True
        else:
            log(f"Real table binding FAILED: {result}", "FAIL")
            error = result.get("error", {}) if result else {}
            log_json("Error details", error)
    else:
        log(f"HTTP {resp.status_code}: {resp.text[:500]}", "FAIL")
    
    # If success, verify definition shows binding
    if success:
        time.sleep(2)
        def_result = api.get_definition(ontology_id)
        if def_result:
            final = def_result.get("definition", {}).get("parts", [])
            for p in final:
                if "DataBindings/" in p.get("path", ""):
                    log(f"  Stored binding at: {p['path']}")
                    log_json("  Content", b64_decode(p["payload"]))
    
    # Cleanup
    api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
    
    return success


# ============================================================================
# TEST 7: Check if gold_nodes table is a managed table 
# ============================================================================
def test_7_check_table_properties(api: FabricAPI) -> bool:
    """Check lakehouse table properties to verify managed vs external."""
    log(f"{Colors.BOLD}TEST 7: Verify Lakehouse table properties{Colors.END}")
    
    if not api.lakehouse_id:
        log("No lakehouse ID", "WARN")
        return False
    
    # Try the tables endpoint
    resp = api.get(f"workspaces/{api.workspace_id}/lakehouses/{api.lakehouse_id}/tables")
    log(f"Tables API response: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        log_json("Tables response", data)
        return True
    else:
        log(f"Tables API: {resp.text[:300]}", "WARN")
    
    # Try listing lakehouse details  
    resp = api.get(f"workspaces/{api.workspace_id}/lakehouses/{api.lakehouse_id}")
    if resp.status_code == 200:
        data = resp.json()
        log_json("Lakehouse details", data)
    
    return False


# ============================================================================
# TEST 8: Explore what the UI sends (get definition of manually created ontology)
# ============================================================================
def test_8_inspect_ui_ontology(api: FabricAPI) -> bool:
    """
    Create an ontology via API, then check it in the portal.
    Leave it for 60s so user can manually add a binding in the UI,
    then read back the definition to see exact structure.
    """
    log(f"{Colors.BOLD}TEST 8: Create ontology for UI inspection{Colors.END}")
    
    test_name = f"ResearchUIInspect_{datetime.now().strftime('%H%M%S')}"
    
    # Create with entity
    resp = api.post(f"workspaces/{api.workspace_id}/ontologies", {
        "displayName": test_name,
        "description": "Add a data binding manually in the Fabric portal, then press Enter here"
    })
    api.wait_lro(resp, "create")
    
    resp = api.get(f"workspaces/{api.workspace_id}/ontologies")
    ontology_id = None
    for ont in resp.json().get("value", []):
        if ont["displayName"] == test_name:
            ontology_id = ont["id"]
            break
    
    if not ontology_id:
        return False
    
    # Upload a simple entity
    entity_id = "1001001001001"
    uri_prop = "3001001001001"
    name_prop = "2001001001001"
    
    entity = {
        "id": entity_id, "namespace": "research", "name": "TestEntity",
        "namespaceType": "Custom", "visibility": "Visible",
        "baseEntityTypeId": None,
        "entityIdParts": [uri_prop],
        "displayNamePropertyId": name_prop,
        "properties": [
            {"id": uri_prop, "name": "uri", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None},
            {"id": name_prop, "name": "DisplayName", "valueType": "String", "redefines": None, "baseTypeNamespaceType": None}
        ],
        "timeseriesProperties": []
    }
    
    parts = [
        {"path": ".platform", "payload": b64({"metadata": {"type": "Ontology", "displayName": test_name}}), "payloadType": "InlineBase64"},
        {"path": "definition.json", "payload": b64({}), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{entity_id}/definition.json", "payload": b64(entity), "payloadType": "InlineBase64"},
    ]
    
    resp = api.post(
        f"workspaces/{api.workspace_id}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": parts}}
    )
    api.wait_lro(resp, "upload entity")
    
    log("=" * 60)
    log(f"Ontology '{test_name}' created with 1 entity type (TestEntity).")
    log(f"Open Fabric portal → Workspace → Ontologies → '{test_name}'")
    log(f"Add a data binding manually to the 'TestEntity' entity type.")
    log(f"Bind it to gold_nodes table (or any table).")
    log("When done, press Enter to read back the definition...")
    log("=" * 60)
    
    input("Press Enter after adding binding in Fabric UI...")
    
    # Read back definition
    definition = api.get_definition(ontology_id)
    if definition:
        all_parts = definition.get("definition", {}).get("parts", [])
        
        log(f"\nDefinition has {len(all_parts)} parts after UI binding:")
        for p in all_parts:
            path = p.get("path", "")
            content = b64_decode(p["payload"])
            log(f"\n  Path: {path}")
            log_json(f"  Content", content, max_chars=2000)
        
        # Save to file for detailed analysis
        output_path = f"research/ui_binding_definition_{datetime.now().strftime('%H%M%S')}.json"
        decoded = {}
        for p in all_parts:
            decoded[p["path"]] = b64_decode(p["payload"])
        
        with open(output_path, "w") as f:
            json.dump(decoded, f, indent=2)
        log(f"\nSaved decoded definition to: {output_path}", "OK")
    
    # Ask if user wants to keep or delete
    keep = input("Keep ontology for further inspection? (y/N): ").strip().lower()
    if keep != "y":
        api.delete(f"workspaces/{api.workspace_id}/ontologies/{ontology_id}")
        log("Ontology deleted", "OK")
    else:
        log(f"Ontology kept: {ontology_id}")
    
    return True


# ============================================================================
# MAIN
# ============================================================================
def run_tests(test_nums=None):
    log("=" * 70)
    log(f"{Colors.BOLD}FABRIC ONTOLOGY DATA BINDING RESEARCH{Colors.END}")
    log("=" * 70)
    
    api = FabricAPI()
    log("Authenticated with Fabric API", "OK")
    
    all_tests = {
        1: ("Discover IDs", test_1_discover_ids),
        2: ("Create ontology + entities", test_2_create_ontology_with_entities),
        3: ("Minimal data binding", test_3_minimal_binding),
        4: ("Binding variations", test_4_binding_variations),
        5: ("Relationship binding", test_5_relationship_binding),
        6: ("Real table binding", test_6_real_table_binding),
        7: ("Check table properties", test_7_check_table_properties),
        8: ("UI inspection (interactive)", test_8_inspect_ui_ontology),
    }
    
    # Default: run tests 1 then whatever else is requested
    if not test_nums:
        test_nums = list(all_tests.keys())
    
    results = {}
    
    for num in test_nums:
        if num not in all_tests:
            log(f"Unknown test {num}", "WARN")
            continue
        
        name, func = all_tests[num]
        log(f"\n{'=' * 70}")
        
        try:
            if num == 1:
                result = func(api)
            elif num == 2:
                result = func(api)
                if result:
                    # Cleanup the test ontology
                    api.delete(f"workspaces/{api.workspace_id}/ontologies/{result}")
            elif num in [3, 5, 6, 7, 8]:
                result = func(api)
            elif num == 4:
                result = func(api)
            else:
                result = func(api)
            
            results[num] = (name, "PASS" if result else "FAIL")
        except Exception as e:
            log(f"Test {num} ({name}) EXCEPTION: {e}", "FAIL")
            traceback.print_exc()
            results[num] = (name, f"ERROR: {e}")
    
    # Final summary
    log(f"\n{'=' * 70}")
    log(f"{Colors.BOLD}RESEARCH SUMMARY{Colors.END}")
    log(f"{'=' * 70}")
    for num, (name, status) in results.items():
        level = "OK" if status == "PASS" else "FAIL"
        log(f"  Test {num}: {name} → {status}", level)


if __name__ == "__main__":
    # Parse command line: --test 1,2,3 or --test 8
    test_nums = None
    if "--test" in sys.argv:
        idx = sys.argv.index("--test")
        if idx + 1 < len(sys.argv):
            test_nums = [int(x) for x in sys.argv[idx + 1].split(",")]
    
    if "--quiet" in sys.argv:
        VERBOSE = False
    
    run_tests(test_nums)
