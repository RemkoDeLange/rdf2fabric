#!/usr/bin/env python3
"""
GraphModel API Systematic Testing
Finds the exact working format for updateDefinition
"""

import json
import base64
import time
import subprocess
import requests

# Configuration
WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
GRAPH_MODEL_ID = "08175951-7f68-48aa-aa44-a14e72e8adc0"
LAKEHOUSE_ID = "32e17923-0b8b-4106-953a-6d63081fa361"
API_BASE = "https://api.fabric.microsoft.com/v1"

# OneLake path (confirmed working path with /dbo/)
CONTAINER_PATH = f"abfss://{WORKSPACE_ID}@onelake.dfs.fabric.microsoft.com/{LAKEHOUSE_ID}/Tables/dbo/gold_Container"

def get_token():
    """Get fresh Azure token"""
    result = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    return result.stdout.strip()

def enc(obj):
    """Base64 encode JSON"""
    return base64.b64encode(json.dumps(obj).encode()).decode()

def test_update(name, parts, token):
    """Test updateDefinition with given parts"""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    url = f"{API_BASE}/workspaces/{WORKSPACE_ID}/GraphModels/{GRAPH_MODEL_ID}/updateDefinition"
    payload = {"definition": {"format": "json", "parts": parts}}
    
    print(f"Parts: {[p['path'] for p in parts]}")
    
    resp = requests.post(url, headers=headers, json=payload, timeout=300)
    print(f"Response: {resp.status_code}")
    
    if resp.status_code == 202:
        op_url = resp.headers.get("Location")
        print(f"LRO: {op_url}")
        
        for i in range(30):
            time.sleep(3)
            pr = requests.get(op_url, headers=headers, timeout=60)
            if pr.status_code == 200:
                data = pr.json()
                status = data.get("status", "Unknown")
                print(f"  [{i+1}] {status}")
                
                if status in ("Succeeded", "Completed"):
                    print("  ✓ SUCCESS")
                    return True
                elif status in ("Failed", "Cancelled"):
                    err = data.get("error", {})
                    print(f"  ✗ FAILED: {err}")
                    return False
            else:
                print(f"  [{i+1}] HTTP {pr.status_code}")
        
        print("  ⚠ Timeout")
        return False
        
    elif resp.status_code == 200:
        print("  ✓ Sync success")
        return True
    else:
        print(f"  ✗ Error: {resp.text[:500]}")
        return False

def main():
    token = get_token()
    if not token:
        print("ERROR: Could not get token")
        return
    
    print("Token obtained successfully")
    
    # CORRECT FORMAT DISCOVERED FROM CURRENT DEFINITION:
    # - All JSON files need $schema
    # - dataSources.json is an OBJECT with "dataSources" array property
    # - graphType.json is an OBJECT with nodeTypes/edgeTypes arrays
    # - positions/styles are OBJECTS not arrays
    
    # Platform config (with correct logicalId)
    platform = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "GraphModel", "displayName": "RDF_Translated_Ontology_graph_0ace9697a665420f91b8a0ad73b9464a"},
        "config": {"version": "2.0", "logicalId": "00000000-0000-0000-0000-000000000000"}
    }
    
    # Styling config (CORRECTED: positions/styles are OBJECTS, include visualFormat)
    styling = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/stylingConfiguration/1.0.0/schema.json",
        "modelLayout": {
            "positions": {},
            "styles": {},
            "pan": {"x": 0.0, "y": 0.0},
            "zoomLevel": 1.0
        },
        "visualFormat": None
    }
    
    # ============================================================
    # TEST A: Empty arrays with CORRECT format
    # ============================================================
    parts_a = [
        {"path": ".platform", "payload": enc(platform), "payloadType": "InlineBase64"},
        {"path": "dataSources.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/dataSources/1.0.0/schema.json",
            "dataSources": []
        }), "payloadType": "InlineBase64"},
        {"path": "graphType.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphType/1.0.0/schema.json",
            "nodeTypes": [],
            "edgeTypes": []
        }), "payloadType": "InlineBase64"},
        {"path": "graphDefinition.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphDefinition/1.0.0/schema.json",
            "nodeTables": [],
            "edgeTables": []
        }), "payloadType": "InlineBase64"},
        {"path": "stylingConfiguration.json", "payload": enc(styling), "payloadType": "InlineBase64"},
    ]
    result_a = test_update("A: Empty arrays (CORRECTED FORMAT)", parts_a, token)
    
    if not result_a:
        print("\n*** CORRECTED BASELINE FAILED - check format ***")
        return
    
    # ============================================================
    # TEST B: 1 dataSource only, no nodeTypes
    # ============================================================
    parts_b = [
        {"path": ".platform", "payload": enc(platform), "payloadType": "InlineBase64"},
        {"path": "dataSources.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/dataSources/1.0.0/schema.json",
            "dataSources": [{"name": "ds1", "type": "DeltaTable", "properties": {"path": CONTAINER_PATH}}]
        }), "payloadType": "InlineBase64"},
        {"path": "graphType.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphType/1.0.0/schema.json",
            "nodeTypes": [],
            "edgeTypes": []
        }), "payloadType": "InlineBase64"},
        {"path": "graphDefinition.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphDefinition/1.0.0/schema.json",
            "nodeTables": [],
            "edgeTables": []
        }), "payloadType": "InlineBase64"},
        {"path": "stylingConfiguration.json", "payload": enc(styling), "payloadType": "InlineBase64"},
    ]
    result_b = test_update("B: 1 dataSource, empty nodeTypes", parts_b, token)
    
    if not result_b:
        print("\n*** DataSource format issue ***")
        return
    
    # ============================================================
    # TEST C: dataSource + nodeType + nodeTable
    # ============================================================
    parts_c = [
        {"path": ".platform", "payload": enc(platform), "payloadType": "InlineBase64"},
        {"path": "dataSources.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/dataSources/1.0.0/schema.json",
            "dataSources": [{"name": "ds1", "type": "DeltaTable", "properties": {"path": CONTAINER_PATH}}]
        }), "payloadType": "InlineBase64"},
        {"path": "graphType.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphType/1.0.0/schema.json",
            "nodeTypes": [{
                "alias": "Container",
                "labels": ["Container"],
                "primaryKeyProperties": ["id"],
                "properties": [{"name": "id", "type": "STRING"}]
            }],
            "edgeTypes": []
        }), "payloadType": "InlineBase64"},
        {"path": "graphDefinition.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphDefinition/1.0.0/schema.json",
            "nodeTables": [{
                "id": "Container_table1",
                "nodeTypeAlias": "Container",
                "dataSourceName": "ds1",
                "propertyMappings": [{"propertyName": "id", "sourceColumn": "id"}]
            }],
            "edgeTables": []
        }), "payloadType": "InlineBase64"},
        {"path": "stylingConfiguration.json", "payload": enc(styling), "payloadType": "InlineBase64"},
    ]
    result_c = test_update("C: Full minimal (1 node type)", parts_c, token)
    
    if result_c:
        print("\n" + "="*60)
        print("SUCCESS! Working format confirmed:")
        print("="*60)
        print("\nKey findings:")
        print("1. All JSON files need $schema")
        print("2. dataSources.json wraps array in object: {dataSources: [...]}")
        print("3. positions/styles are objects {}, not arrays []")
        print("4. visualFormat: null is required")
    else:
        print("\n*** nodeType/nodeTable format issue ***")

if __name__ == "__main__":
    main()
