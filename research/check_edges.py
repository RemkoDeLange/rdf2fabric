#!/usr/bin/env python3
"""Check gold_edges table and GraphModel edge configuration."""

import subprocess
import json
import requests
import base64
import time

# Configuration
WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
LAKEHOUSE_ID = "32e17923-0b8b-4106-953a-6d63081fa361"
FABRIC_API = "https://api.fabric.microsoft.com/v1"

def get_token():
    # Try multiple paths for az CLI
    az_paths = [
        "az",
        r"C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd",
        r"C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd",
    ]
    for az_path in az_paths:
        try:
            result = subprocess.run(
                [az_path, "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"],
                capture_output=True, text=True, check=True, shell=(az_path == "az")
            )
            return result.stdout.strip()
        except FileNotFoundError:
            continue
    raise RuntimeError("Azure CLI not found")

def get_headers():
    return {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}

def find_graphmodel():
    """Find GraphModel in workspace."""
    resp = requests.get(f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/graphModels", headers=get_headers())
    if resp.status_code == 200:
        models = resp.json().get("value", [])
        if models:
            return models[0]
    return None

def get_graphmodel_definition(gm_id):
    """Get GraphModel definition via LRO."""
    # Try with explicit format parameter
    resp = requests.post(
        f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/graphModels/{gm_id}/getDefinition?format=json",
        headers=get_headers(),
        json={}
    )
    if resp.status_code != 202:
        print(f"getDefinition failed: {resp.status_code}")
        return None
    
    location = resp.headers.get("Location")
    # Poll for completion
    for _ in range(30):
        time.sleep(2)
        poll_resp = requests.get(location, headers=get_headers())
        if poll_resp.status_code == 200:
            data = poll_resp.json()
            if data.get("status") == "Succeeded":
                # Get result
                result_resp = requests.get(f"{location}/result", headers=get_headers())
                if result_resp.status_code == 200:
                    result = result_resp.json()
                    # Debug: print all part paths
                    parts = result.get("definition", {}).get("parts", [])
                    print(f"\nDEBUG: Found {len(parts)} parts:")
                    for p in parts:
                        print(f"  - {p.get('path')}")
                    return result
                break
    return None

def decode_part(definition, path):
    """Decode base64 part from definition."""
    for part in definition.get("definition", {}).get("parts", []):
        if part.get("path") == path:
            payload = part.get("payload", "")
            try:
                return json.loads(base64.b64decode(payload).decode("utf-8"))
            except:
                return None
    return None

def main():
    print("=" * 60)
    print("EDGE BINDING INVESTIGATION")
    print("=" * 60)
    
    # Find GraphModel
    gm = find_graphmodel()
    if not gm:
        print("ERROR: No GraphModel found")
        return
    
    gm_id = gm["id"]
    print(f"\nGraphModel: {gm['displayName']} ({gm_id})")
    
    # Get definition
    print("\nFetching GraphModel definition...")
    definition = get_graphmodel_definition(gm_id)
    if not definition:
        print("ERROR: Could not fetch definition")
        return
    
    # Check graphType for edgeTypes
    print("\n--- graphType.json (edgeTypes) ---")
    graph_type = decode_part(definition, "graphType.json")
    if graph_type:
        edge_types = graph_type.get("edgeTypes", [])
        print(f"Edge types defined: {len(edge_types)}")
        for et in edge_types[:5]:
            print(f"  - {et.get('alias')}: {et.get('sourceNodeType', {}).get('alias')} -> {et.get('destinationNodeType', {}).get('alias')}")
        if len(edge_types) > 5:
            print(f"  ... and {len(edge_types) - 5} more")
    else:
        print("ERROR: No graphType.json found")
    
    # Check graphDefinition for edgeTables
    print("\n--- graphDefinition.json (edgeTables) ---")
    graph_def = decode_part(definition, "graphDefinition.json")
    if graph_def:
        edge_tables = graph_def.get("edgeTables", [])
        print(f"Edge tables defined: {len(edge_tables)}")
        for et in edge_tables[:5]:
            print(f"  - {et.get('name')}")
            print(f"    dataSource: {et.get('dataSource')}")
            print(f"    filterExpression: {et.get('filterExpression', 'NONE')}")
            print(f"    sourceNodeIdColumn: {et.get('sourceNodeIdColumn')}")
            print(f"    destinationNodeIdColumn: {et.get('destinationNodeIdColumn')}")
        if len(edge_tables) > 5:
            print(f"  ... and {len(edge_tables) - 5} more")
    else:
        print("ERROR: No graphDefinition.json found")
    
    # Check dataSources for gold_edges
    print("\n--- dataSources.json ---")
    data_sources = decode_part(definition, "dataSources.json")
    if data_sources:
        sources = data_sources.get("dataSources", [])
        print(f"Data sources defined: {len(sources)}")
        edge_source = None
        for ds in sources:
            name = ds.get("name", "")
            print(f"  - {name}: {ds.get('type')}")
            if "edge" in name.lower():
                edge_source = ds
        
        if edge_source:
            print(f"\nEdge data source path:")
            print(f"  {edge_source.get('properties', {}).get('path', 'NOT SET')}")
        else:
            print("\nWARNING: No 'edge' data source found!")
    else:
        print("ERROR: No dataSources.json found")
    
    print("\n" + "=" * 60)
    print("RECOMMENDATIONS:")
    print("=" * 60)
    
    if graph_type and len(graph_type.get("edgeTypes", [])) == 0:
        print("- No edge types in graphType.json - need to define edgeTypes")
    
    if graph_def and len(graph_def.get("edgeTables", [])) == 0:
        print("- No edge tables in graphDefinition.json - need to define edgeTables")
    
    if data_sources:
        has_edge_source = any("edge" in ds.get("name", "").lower() for ds in data_sources.get("dataSources", []))
        if not has_edge_source:
            print("- No edge data source - need to add gold_edges to dataSources")
    
    print("\nNext: Check if gold_edges table has data in Fabric lakehouse")

if __name__ == "__main__":
    main()
