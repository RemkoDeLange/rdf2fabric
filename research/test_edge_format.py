#!/usr/bin/env python3
"""Test GraphModel edgeTable format to find the correct filter syntax."""

import subprocess
import json
import requests
import base64
import time

# Configuration
WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
LAKEHOUSE_ID = "32e17923-0b8b-4106-953a-6d63081fa361"
FABRIC_API = "https://api.fabric.microsoft.com/v1"

ONELAKE_BASE = f"abfss://{WORKSPACE_ID}@onelake.dfs.fabric.microsoft.com/{LAKEHOUSE_ID}/Tables/dbo"

def get_token():
    result = subprocess.run(
        ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True, check=True, shell=True
    )
    return result.stdout.strip()

def get_headers():
    return {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}

def enc(obj):
    return base64.b64encode(json.dumps(obj).encode()).decode()

def find_graphmodel():
    resp = requests.get(f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/graphModels", headers=get_headers())
    if resp.status_code == 200:
        models = resp.json().get("value", [])
        if models:
            return models[0]
    return None

def test_edge_format(name, graph_definition, graph_type, data_sources):
    """Test a specific graph definition with edge tables."""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    
    gm = find_graphmodel()
    if not gm:
        print("ERROR: No GraphModel found")
        return False
    
    gm_id = gm["id"]
    
    platform = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "GraphModel", "displayName": gm["displayName"]},
        "config": {"version": "2.0", "logicalId": "00000000-0000-0000-0000-000000000000"}
    }
    
    styling = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/stylingConfiguration/1.0.0/schema.json",
        "modelLayout": {"positions": {}, "styles": {}, "pan": {"x": 0, "y": 0}, "zoomLevel": 1},
        "visualFormat": None
    }
    
    parts = [
        {"path": ".platform", "payload": enc(platform), "payloadType": "InlineBase64"},
        {"path": "dataSources.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/dataSources/1.0.0/schema.json",
            "dataSources": data_sources
        }), "payloadType": "InlineBase64"},
        {"path": "graphType.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphType/1.0.0/schema.json",
            **graph_type
        }), "payloadType": "InlineBase64"},
        {"path": "graphDefinition.json", "payload": enc({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/graphInstance/definition/graphDefinition/1.0.0/schema.json",
            **graph_definition
        }), "payloadType": "InlineBase64"},
        {"path": "stylingConfiguration.json", "payload": enc(styling), "payloadType": "InlineBase64"},
    ]
    
    print(f"graphDefinition: {json.dumps(graph_definition, indent=2)[:500]}")
    
    resp = requests.post(
        f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/updateDefinition",
        headers=get_headers(),
        json={"definition": {"parts": parts}},
        timeout=300
    )
    
    print(f"\nResponse: {resp.status_code}")
    
    if resp.status_code == 202:
        location = resp.headers.get("Location")
        for i in range(30):
            time.sleep(3)
            poll = requests.get(location, headers=get_headers())
            if poll.status_code == 200:
                data = poll.json()
                status = data.get("status")
                print(f"  [{i+1}] {status}")
                if status == "Succeeded":
                    print("✓ SUCCESS")
                    return True
                elif status in ("Failed", "Cancelled"):
                    print(f"✗ {status}: {data.get('error', {})}")
                    return False
        print("✗ Timeout")
        return False
    elif resp.status_code == 200:
        print("✓ SUCCESS (sync)")
        return True
    else:
        print(f"✗ Failed: {resp.text[:300]}")
        return False


def main():
    print("=" * 60)
    print("EDGE TABLE FORMAT TESTING")
    print("=" * 60)
    
    # Base data sources: 2 node tables + edge table
    data_sources = [
        {"name": "matter_ds", "type": "DeltaTable", "properties": {"path": f"{ONELAKE_BASE}/gold_matter"}},
        {"name": "aggregationstatetype_ds", "type": "DeltaTable", "properties": {"path": f"{ONELAKE_BASE}/gold_aggregationstatetype"}},
        {"name": "edges_ds", "type": "DeltaTable", "properties": {"path": f"{ONELAKE_BASE}/gold_edges"}}
    ]
    
    # Base graph type
    graph_type = {
        "nodeTypes": [
            {"alias": "Matter_nodeType", "labels": ["Matter"], "primaryKeyProperties": ["id"], "properties": [{"name": "id", "type": "STRING"}]},
            {"alias": "Aggregationstatetype_nodeType", "labels": ["Aggregationstatetype"], "primaryKeyProperties": ["id"], "properties": [{"name": "id", "type": "STRING"}]}
        ],
        "edgeTypes": [
            {"alias": "aggregationstatetype_edgeType", "labels": ["aggregationstatetype"], "sourceNodeType": {"alias": "Matter_nodeType"}, "destinationNodeType": {"alias": "Aggregationstatetype_nodeType"}, "properties": []}
        ]
    }
    
    # Base node tables
    node_tables = [
        {"id": "Matter_table", "nodeTypeAlias": "Matter_nodeType", "dataSourceName": "matter_ds", "propertyMappings": [{"propertyName": "id", "sourceColumn": "id"}]},
        {"id": "Aggregationstatetype_table", "nodeTypeAlias": "Aggregationstatetype_nodeType", "dataSourceName": "aggregationstatetype_ds", "propertyMappings": [{"propertyName": "id", "sourceColumn": "id"}]}
    ]
    
    # ========================================
    # TEST 1: No filter (all edges)
    # ========================================
    graph_def_1 = {
        "nodeTables": node_tables,
        "edgeTables": [{
            "id": "edge_table_1",
            "edgeTypeAlias": "aggregationstatetype_edgeType",
            "dataSourceName": "edges_ds",
            "sourceNodeKeyColumns": ["source_id"],
            "destinationNodeKeyColumns": ["target_id"],
            "propertyMappings": []
        }]
    }
    result1 = test_edge_format("No filter", graph_def_1, graph_type, data_sources)
    
    if not result1:
        print("\n*** Base edge table format failed ***")
        return
    
    # ========================================
    # TEST 2: filterExpression as string
    # ========================================
    graph_def_2 = {
        "nodeTables": node_tables,
        "edgeTables": [{
            "id": "edge_table_2",
            "edgeTypeAlias": "aggregationstatetype_edgeType",
            "dataSourceName": "edges_ds",
            "sourceNodeKeyColumns": ["source_id"],
            "destinationNodeKeyColumns": ["target_id"],
            "propertyMappings": [],
            "filterExpression": "type = 'aggregationstatetype'"
        }]
    }
    result2 = test_edge_format("filterExpression string", graph_def_2, graph_type, data_sources)
    
    # ========================================
    # TEST 3: filter object (our current code)
    # ========================================
    graph_def_3 = {
        "nodeTables": node_tables,
        "edgeTables": [{
            "id": "edge_table_3",
            "edgeTypeAlias": "aggregationstatetype_edgeType",
            "dataSourceName": "edges_ds",
            "sourceNodeKeyColumns": ["source_id"],
            "destinationNodeKeyColumns": ["target_id"],
            "propertyMappings": [],
            "filter": {"operator": "Equal", "columnName": "type", "value": "aggregationstatetype"}
        }]
    }
    result3 = test_edge_format("filter object", graph_def_3, graph_type, data_sources)
    
    # ========================================
    # Summary
    # ========================================
    print("\n" + "=" * 60)
    print("RESULTS:")
    print("=" * 60)
    print(f"  No filter:            {'✓' if result1 else '✗'}")
    print(f"  filterExpression:     {'✓' if result2 else '✗'}")
    print(f"  filter object:        {'✓' if result3 else '✗'}")


if __name__ == "__main__":
    main()
