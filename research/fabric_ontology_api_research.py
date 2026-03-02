"""
Fabric Ontology API Research Script
====================================
Testing minimal ontology definitions to understand exact API requirements.

Run from terminal: python research/fabric_ontology_api_research.py
"""

import requests
import json
import base64
import subprocess
import time
from datetime import datetime

# Get token via Azure CLI
def get_fabric_token():
    """Get Fabric API token using Azure CLI."""
    result = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    if result.returncode != 0:
        raise Exception(f"Failed to get token: {result.stderr}")
    return result.stdout.strip()

# API helper
class FabricAPI:
    def __init__(self):
        self.token = get_fabric_token()
        self.base_url = "https://api.fabric.microsoft.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def get(self, endpoint):
        url = f"{self.base_url}/{endpoint}"
        resp = requests.get(url, headers=self.headers)
        return resp
    
    def post(self, endpoint, data):
        url = f"{self.base_url}/{endpoint}"
        resp = requests.post(url, headers=self.headers, json=data)
        return resp
    
    def delete(self, endpoint):
        url = f"{self.base_url}/{endpoint}"
        resp = requests.delete(url, headers=self.headers)
        return resp
    
    def wait_for_lro(self, operation_url, timeout=120):
        """Poll LRO until complete."""
        start = time.time()
        while time.time() - start < timeout:
            resp = requests.get(operation_url, headers=self.headers)
            if resp.status_code != 200:
                return {"status": "Error", "error": resp.text}
            
            result = resp.json()
            status = result.get("status", "Unknown")
            
            if status in ["Succeeded", "Completed"]:
                return result
            elif status in ["Failed", "Cancelled"]:
                return result
            
            time.sleep(2)
        
        return {"status": "Timeout"}

def encode_payload(data):
    """Encode dict as base64 JSON."""
    return base64.b64encode(json.dumps(data).encode()).decode()

def log(msg):
    """Print with timestamp."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

# ============================================================================
# RESEARCH TESTS
# ============================================================================

def test_1_list_workspaces(api):
    """Find the dev workspace."""
    log("TEST 1: List workspaces")
    resp = api.get("workspaces")
    if resp.status_code == 200:
        workspaces = resp.json().get("value", [])
        for ws in workspaces:
            log(f"  - {ws['displayName']} ({ws['id']})")
            if "rdf" in ws["displayName"].lower():
                return ws["id"]
    else:
        log(f"  ERROR: {resp.status_code} - {resp.text}")
    return None

def test_2_list_ontologies(api, workspace_id):
    """List existing ontologies."""
    log("TEST 2: List ontologies")
    resp = api.get(f"workspaces/{workspace_id}/ontologies")
    if resp.status_code == 200:
        ontologies = resp.json().get("value", [])
        log(f"  Found {len(ontologies)} ontologies")
        for ont in ontologies:
            log(f"  - {ont['displayName']} ({ont['id']})")
        return ontologies
    else:
        log(f"  ERROR: {resp.status_code} - {resp.text}")
    return []

def test_3_create_minimal_ontology(api, workspace_id):
    """Create an empty ontology."""
    log("TEST 3: Create minimal ontology")
    
    data = {
        "displayName": f"ResearchTest_{datetime.now().strftime('%H%M%S')}",
        "description": "API research test - can be deleted"
    }
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies", data)
    
    if resp.status_code == 201:
        result = resp.json()
        log(f"  SUCCESS: Created ontology {result['id']}")
        return result["id"]
    elif resp.status_code == 202:
        # Async operation
        operation_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        log(f"  Async operation started: {operation_url}")
        if operation_url:
            lro_result = api.wait_for_lro(operation_url)
            log(f"  LRO result: {lro_result.get('status')}")
            # Try to find the created ontology
            ontologies = test_2_list_ontologies(api, workspace_id)
            for ont in ontologies:
                if ont["displayName"] == data["displayName"]:
                    return ont["id"]
    else:
        log(f"  ERROR: {resp.status_code}")
        log(f"  Response: {resp.text[:500]}")
    
    return None

def test_4_upload_minimal_definition(api, workspace_id, ontology_id):
    """Upload minimal definition with ONE entity type."""
    log("TEST 4: Upload minimal definition (1 entity type)")
    
    # Minimal entity type
    entity_def = {
        "id": 1234567890123456789,  # 64-bit integer
        "namespace": "research",
        "name": "Person",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "baseEntityTypeId": None,
        "entityIdParts": [1111111111111111111],
        "displayNamePropertyId": 1111111111111111111,
        "properties": [
            {
                "id": 1111111111111111111,
                "name": "uri",
                "valueType": "String",
                "redefines": None,
                "baseTypeNamespaceType": None
            }
        ],
        "timeseriesProperties": []
    }
    
    # Build definition parts
    parts = [
        {
            "path": ".platform",
            "payload": encode_payload({
                "metadata": {
                    "type": "Ontology",
                    "displayName": "Research Test Ontology"
                }
            }),
            "payloadType": "InlineBase64"
        },
        {
            "path": "definition.json",
            "payload": encode_payload({}),
            "payloadType": "InlineBase64"
        },
        {
            "path": f"EntityTypes/{entity_def['id']}/definition.json",
            "payload": encode_payload(entity_def),
            "payloadType": "InlineBase64"
        }
    ]
    
    data = {"definition": {"parts": parts}}
    
    log(f"  Uploading {len(parts)} parts...")
    log(f"  Entity def: {json.dumps(entity_def, indent=2)[:500]}")
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/updateDefinition", data)
    
    if resp.status_code == 200:
        log("  SUCCESS: Definition uploaded (sync)")
        return True
    elif resp.status_code == 202:
        operation_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        log(f"  Async operation: {operation_url}")
        if operation_url:
            lro_result = api.wait_for_lro(operation_url)
            status = lro_result.get("status")
            log(f"  LRO status: {status}")
            if status in ["Succeeded", "Completed"]:
                return True
            else:
                log(f"  LRO error: {json.dumps(lro_result, indent=2)}")
                return False
    else:
        log(f"  ERROR: {resp.status_code}")
        log(f"  Response: {resp.text}")
    
    return False

def test_5_upload_without_optional_fields(api, workspace_id, ontology_id):
    """Test which fields are truly required."""
    log("TEST 5: Upload with minimal fields only")
    
    # Try removing optional fields
    entity_def = {
        "id": 2222222222222222222,
        "namespace": "research",
        "name": "MinimalEntity",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "properties": [
            {
                "id": 3333333333333333333,
                "name": "id",
                "valueType": "String"
            }
        ]
    }
    
    parts = [
        {
            "path": ".platform",
            "payload": encode_payload({"metadata": {"type": "Ontology", "displayName": "Test"}}),
            "payloadType": "InlineBase64"
        },
        {
            "path": "definition.json",
            "payload": encode_payload({}),
            "payloadType": "InlineBase64"
        },
        {
            "path": f"EntityTypes/{entity_def['id']}/definition.json",
            "payload": encode_payload(entity_def),
            "payloadType": "InlineBase64"
        }
    ]
    
    data = {"definition": {"parts": parts}}
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/updateDefinition", data)
    
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        if operation_url:
            lro_result = api.wait_for_lro(operation_url)
            status = lro_result.get("status")
            log(f"  Result: {status}")
            if status not in ["Succeeded", "Completed"]:
                log(f"  Error details: {json.dumps(lro_result, indent=2)}")
            return status in ["Succeeded", "Completed"]
    else:
        log(f"  Response: {resp.status_code} - {resp.text[:300]}")
    
    return False

def test_6_relationship_type(api, workspace_id, ontology_id):
    """Test adding a relationship type."""
    log("TEST 6: Upload with relationship type")
    
    entity1 = {
        "id": 4444444444444444444,
        "namespace": "research",
        "name": "Company",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "properties": [{"id": 5555555555555555555, "name": "name", "valueType": "String"}]
    }
    
    entity2 = {
        "id": 6666666666666666666,
        "namespace": "research",
        "name": "Employee",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "properties": [{"id": 7777777777777777777, "name": "name", "valueType": "String"}]
    }
    
    relationship = {
        "id": 8888888888888888888,
        "namespace": "research",
        "name": "worksFor",
        "namespaceType": "Custom",
        "source": {"entityTypeId": entity2["id"]},
        "target": {"entityTypeId": entity1["id"]}
    }
    
    parts = [
        {"path": ".platform", "payload": encode_payload({"metadata": {"type": "Ontology", "displayName": "Test"}}), "payloadType": "InlineBase64"},
        {"path": "definition.json", "payload": encode_payload({}), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{entity1['id']}/definition.json", "payload": encode_payload(entity1), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/{entity2['id']}/definition.json", "payload": encode_payload(entity2), "payloadType": "InlineBase64"},
        {"path": f"RelationshipTypes/{relationship['id']}/definition.json", "payload": encode_payload(relationship), "payloadType": "InlineBase64"},
    ]
    
    data = {"definition": {"parts": parts}}
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/updateDefinition", data)
    
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        if operation_url:
            lro_result = api.wait_for_lro(operation_url)
            status = lro_result.get("status")
            log(f"  Result: {status}")
            if status not in ["Succeeded", "Completed"]:
                log(f"  Error: {json.dumps(lro_result, indent=2)}")
            return status in ["Succeeded", "Completed"]
    else:
        log(f"  Response: {resp.status_code} - {resp.text[:300]}")
    
    return False

def test_7_cleanup(api, workspace_id, ontology_id):
    """Delete test ontology."""
    log("TEST 7: Cleanup - delete ontology")
    
    resp = api.delete(f"workspaces/{workspace_id}/ontologies/{ontology_id}")
    
    if resp.status_code in [200, 202, 204]:
        log("  SUCCESS: Ontology deleted")
        return True
    else:
        log(f"  Note: {resp.status_code} - {resp.text[:200]}")
    
    return False

def test_8_verify_in_ui(api, workspace_id, ontology_id):
    """Get ontology definition to verify what was uploaded."""
    log("TEST 8: Verify definition via API")
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/getDefinition", {})
    
    if resp.status_code == 200:
        result = resp.json()
        log(f"  Got definition: {json.dumps(result, indent=2)[:500]}")
        return result
    elif resp.status_code == 202:
        operation_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        if operation_url:
            lro_result = api.wait_for_lro(operation_url)
            log(f"  LRO status: {lro_result.get('status')}")
            # After LRO completes, fetch the actual definition
            resp2 = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/getDefinition", {})
            if resp2.status_code == 200:
                return resp2.json()
    else:
        log(f"  Response: {resp.status_code}")
    
    return None

def test_9_inspect_existing_ontology(api, workspace_id):
    """Get definition of existing RDF_Translated_Ontology to see working format."""
    log("TEST 9: Inspect existing ontology definition")
    
    # Find existing ontology
    resp = api.get(f"workspaces/{workspace_id}/ontologies")
    if resp.status_code != 200:
        log(f"  ERROR listing: {resp.status_code}")
        return
    
    ontologies = resp.json().get("value", [])
    existing = None
    for ont in ontologies:
        if "RDF" in ont["displayName"]:
            existing = ont
            break
    
    if not existing:
        log("  No existing RDF ontology found")
        return
    
    log(f"  Found: {existing['displayName']} ({existing['id']})")
    
    # Get definition
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{existing['id']}/getDefinition", {})
    
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        if operation_url:
            lro_result = api.wait_for_lro(operation_url, timeout=60)
            log(f"  LRO: {lro_result.get('status')}")
    
    # Retry after LRO
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{existing['id']}/getDefinition", {})
    if resp.status_code == 200:
        result = resp.json()
        parts = result.get("definition", {}).get("parts", [])
        log(f"  Got {len(parts)} parts")
        
        # Decode and show first entity type
        for part in parts:
            if "EntityTypes/" in part.get("path", "") and "definition.json" in part.get("path", ""):
                content = json.loads(base64.b64decode(part["payload"]).decode())
                log(f"  Sample entity type structure:")
                log(f"    {json.dumps(content, indent=2)}")
                return content
    else:
        log(f"  Response: {resp.status_code}")
    
    return None

def test_10_try_different_id_formats(api, workspace_id):
    """Test different ID formats."""
    log("TEST 10: Test different ID formats")
    
    test_cases = [
        ("small_int", 12345),
        ("medium_int", 1234567890),
        ("large_int", 1234567890123456789),
        ("max_safe_int", 9007199254740991),  # JS Number.MAX_SAFE_INTEGER
    ]
    
    for name, test_id in test_cases:
        log(f"  Testing {name}: {test_id}")
        
        # Create ontology
        data = {"displayName": f"IDTest_{name}_{datetime.now().strftime('%H%M%S')}", "description": "ID test"}
        resp = api.post(f"workspaces/{workspace_id}/ontologies", data)
        
        if resp.status_code == 202:
            operation_url = resp.headers.get("Location")
            if operation_url:
                api.wait_for_lro(operation_url)
        
        # Find created ontology
        resp = api.get(f"workspaces/{workspace_id}/ontologies")
        ontologies = resp.json().get("value", [])
        ontology_id = None
        for ont in ontologies:
            if ont["displayName"].startswith(f"IDTest_{name}"):
                ontology_id = ont["id"]
                break
        
        if not ontology_id:
            log(f"    Could not find created ontology")
            continue
        
        # Try upload with this ID
        entity_def = {
            "id": test_id,
            "namespace": "test",
            "name": "TestEntity",
            "namespaceType": "Custom",
            "visibility": "Visible",
            "properties": []
        }
        
        parts = [
            {"path": ".platform", "payload": encode_payload({"metadata": {"type": "Ontology", "displayName": "Test"}}), "payloadType": "InlineBase64"},
            {"path": "definition.json", "payload": encode_payload({}), "payloadType": "InlineBase64"},
            {"path": f"EntityTypes/{test_id}/definition.json", "payload": encode_payload(entity_def), "payloadType": "InlineBase64"},
        ]
        
        resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/updateDefinition", {"definition": {"parts": parts}})
        
        if resp.status_code == 202:
            operation_url = resp.headers.get("Location")
            if operation_url:
                result = api.wait_for_lro(operation_url)
                status = result.get("status")
                log(f"    Result: {status}")
                if status == "Succeeded":
                    log(f"    *** SUCCESS with ID format: {name} = {test_id} ***")
                else:
                    error = result.get("error", {})
                    log(f"    Error: {error.get('errorCode', 'unknown')}")
        
        # Cleanup
        api.delete(f"workspaces/{workspace_id}/ontologies/{ontology_id}")
        time.sleep(1)

def test_11_try_with_properties_array_empty(api, workspace_id):
    """Test if properties array can be empty."""
    log("TEST 11: Entity with no properties")
    
    # Create ontology
    data = {"displayName": f"PropTest_{datetime.now().strftime('%H%M%S')}", "description": "test"}
    resp = api.post(f"workspaces/{workspace_id}/ontologies", data)
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location")
        if operation_url:
            api.wait_for_lro(operation_url)
    
    # Find it
    resp = api.get(f"workspaces/{workspace_id}/ontologies")
    ontologies = resp.json().get("value", [])
    ontology_id = None
    for ont in ontologies:
        if "PropTest" in ont["displayName"]:
            ontology_id = ont["id"]
            break
    
    if not ontology_id:
        log("  Could not create ontology")
        return
    
    # Try minimal entity - no properties at all
    entity_def = {
        "id": 9999999,
        "namespace": "test",
        "name": "EmptyEntity",
        "namespaceType": "Custom",
        "visibility": "Visible"
    }
    
    parts = [
        {"path": ".platform", "payload": encode_payload({"metadata": {"type": "Ontology", "displayName": "Test"}}), "payloadType": "InlineBase64"},
        {"path": "definition.json", "payload": encode_payload({}), "payloadType": "InlineBase64"},
        {"path": f"EntityTypes/9999999/definition.json", "payload": encode_payload(entity_def), "payloadType": "InlineBase64"},
    ]
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/updateDefinition", {"definition": {"parts": parts}})
    
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location")
        if operation_url:
            result = api.wait_for_lro(operation_url)
            log(f"  Result: {result.get('status')}")
            if result.get("status") == "Succeeded":
                log("  *** SUCCESS with empty properties! ***")
    
    # Cleanup
    api.delete(f"workspaces/{workspace_id}/ontologies/{ontology_id}")

def test_12_try_ui_style_payload(api, workspace_id):
    """Try to mimic what the UI creates."""
    log("TEST 12: UI-style payload")
    
    # Create ontology
    data = {"displayName": f"UITest_{datetime.now().strftime('%H%M%S')}", "description": "test"}
    resp = api.post(f"workspaces/{workspace_id}/ontologies", data)
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location")
        if operation_url:
            api.wait_for_lro(operation_url)
    
    resp = api.get(f"workspaces/{workspace_id}/ontologies")
    ontologies = resp.json().get("value", [])
    ontology_id = None
    for ont in ontologies:
        if "UITest" in ont["displayName"]:
            ontology_id = ont["id"]
            break
    
    if not ontology_id:
        return
    
    # Exact format from UI (guessing based on what usually works)
    entity_id = 1001
    prop_id = 2001
    
    entity_def = {
        "id": entity_id,
        "name": "TestPerson",
        "namespace": "default",
        "namespaceType": "Custom",
        "visibility": "Visible",
        "properties": [
            {
                "id": prop_id,
                "name": "name",
                "valueType": "String"
            }
        ],
        "entityIdParts": [prop_id],
        "displayNamePropertyId": prop_id
    }
    
    parts = [
        {
            "path": ".platform",
            "payload": encode_payload({
                "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
                "metadata": {
                    "type": "Ontology",
                    "displayName": "UITest"
                },
                "config": {
                    "version": "2.0",
                    "logicalId": ontology_id
                }
            }),
            "payloadType": "InlineBase64"
        },
        {
            "path": "definition.json",
            "payload": encode_payload({}),
            "payloadType": "InlineBase64"
        },
        {
            "path": f"EntityTypes/{entity_id}/definition.json",
            "payload": encode_payload(entity_def),
            "payloadType": "InlineBase64"
        }
    ]
    
    log(f"  Entity: {json.dumps(entity_def, indent=2)}")
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/updateDefinition", {"definition": {"parts": parts}})
    
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location")
        if operation_url:
            result = api.wait_for_lro(operation_url)
            log(f"  Result: {result.get('status')}")
            if result.get("status") == "Succeeded":
                log("  *** SUCCESS with UI-style payload! ***")
            else:
                log(f"  Error: {result.get('error')}")
    
    api.delete(f"workspaces/{workspace_id}/ontologies/{ontology_id}")

def test_13_string_ids(api, workspace_id):
    """Test with STRING IDs as shown in Microsoft documentation."""
    log("TEST 13: Using STRING IDs (per MS documentation)")
    
    # Create test ontology
    data = {"displayName": f"StringIDTest_{datetime.now().strftime('%H%M%S')}", "description": "test"}
    resp = api.post(f"workspaces/{workspace_id}/ontologies", data)
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location")
        if operation_url:
            api.wait_for_lro(operation_url)
    
    # Find it
    resp = api.get(f"workspaces/{workspace_id}/ontologies")
    ontologies = resp.json().get("value", [])
    ontology_id = None
    for ont in ontologies:
        if "StringIDTest" in ont["displayName"]:
            ontology_id = ont["id"]
            break
    
    if not ontology_id:
        log("  Could not create ontology")
        return False
    
    # Use STRING IDs like the Microsoft sample
    entity_id = "8888888888888"  # STRING!
    prop_id = "9999999999999"    # STRING!
    
    entity_def = {
        "id": entity_id,  # STRING
        "namespace": "usertypes",
        "baseEntityTypeId": None,
        "name": "TestEquipment",
        "entityIdParts": [prop_id],  # STRING array
        "displayNamePropertyId": prop_id,  # STRING
        "namespaceType": "Custom",
        "visibility": "Visible",
        "properties": [
            {
                "id": prop_id,  # STRING
                "name": "DisplayName",
                "redefines": None,
                "baseTypeNamespaceType": None,
                "valueType": "String"
            }
        ],
        "timeseriesProperties": []
    }
    
    log(f"  Entity definition (with STRING IDs):")
    log(f"    {json.dumps(entity_def, indent=2)}")
    
    parts = [
        {
            "path": "definition.json",
            "payload": encode_payload({}),
            "payloadType": "InlineBase64"
        },
        {
            "path": f"EntityTypes/{entity_id}/definition.json",
            "payload": encode_payload(entity_def),
            "payloadType": "InlineBase64"
        },
        {
            "path": ".platform",
            "payload": encode_payload({
                "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
                "metadata": {
                    "type": "Ontology",
                    "displayName": "StringIDTest"
                },
                "config": {
                    "version": "2.0",
                    "logicalId": ontology_id
                }
            }),
            "payloadType": "InlineBase64"
        }
    ]
    
    resp = api.post(f"workspaces/{workspace_id}/ontologies/{ontology_id}/updateDefinition", {"definition": {"parts": parts}})
    
    success = False
    if resp.status_code == 202:
        operation_url = resp.headers.get("Location")
        if operation_url:
            result = api.wait_for_lro(operation_url)
            log(f"  Result: {result.get('status')}")
            if result.get("status") == "Succeeded":
                log("  *** SUCCESS WITH STRING IDs! ***")
                success = True
            else:
                log(f"  Error: {json.dumps(result.get('error'), indent=2)}")
    else:
        log(f"  Response: {resp.status_code} - {resp.text[:300]}")
    
    # Cleanup
    api.delete(f"workspaces/{workspace_id}/ontologies/{ontology_id}")
    return success

# ============================================================================
# MAIN
# ============================================================================

def main():
    log("=" * 60)
    log("FABRIC ONTOLOGY API RESEARCH v2")
    log("=" * 60)
    
    api = FabricAPI()
    log("Got Fabric API token")
    
    # Find workspace
    workspace_id = test_1_list_workspaces(api)
    if not workspace_id:
        log("ERROR: Could not find workspace")
        return
    
    log(f"Using workspace: {workspace_id}")
    
    # Test with STRING IDs (as per MS documentation)
    test_13_string_ids(api, workspace_id)
    
    log("=" * 60)
    log("RESEARCH COMPLETE")
    log("=" * 60)

if __name__ == "__main__":
    main()
