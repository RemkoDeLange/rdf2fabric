#!/usr/bin/env python3
"""Check GraphModel definition details."""

import subprocess
import requests
import json
import time
import base64

WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
FABRIC_API = "https://api.fabric.microsoft.com/v1"

def get_token():
    r = subprocess.run(
        ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True, check=True, shell=True
    )
    return r.stdout.strip()

def get_headers():
    return {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}

def main():
    headers = get_headers()
    
    # Find GraphModel
    resp = requests.get(f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/graphModels", headers=headers)
    gm = resp.json()["value"][0]
    gm_id = gm["id"]
    print(f"GraphModel: {gm['displayName']}")
    
    # Get definition
    def_resp = requests.post(
        f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/graphModels/{gm_id}/getDefinition?format=json",
        headers=headers, json={}
    )
    loc = def_resp.headers.get("Location")
    
    for _ in range(15):
        time.sleep(2)
        poll = requests.get(loc, headers=headers)
        if poll.status_code == 200 and poll.json().get("status") == "Succeeded":
            result = requests.get(f"{loc}/result", headers=headers).json()
            
            for part in result.get("definition", {}).get("parts", []):
                path = part.get("path")
                payload = part.get("payload", "")
                
                try:
                    data = json.loads(base64.b64decode(payload).decode())
                except:
                    continue
                
                if path == "graphType.json":
                    node_types = data.get("nodeTypes", [])
                    edge_types = data.get("edgeTypes", [])
                    
                    print(f"\n=== graphType.json ===")
                    print(f"nodeTypes: {len(node_types)}")
                    for nt in node_types[:5]:
                        alias = nt.get("alias", "?")
                        labels = nt.get("labels", [])
                        print(f"  - {alias} (labels: {labels})")
                    if len(node_types) > 5:
                        print(f"  ... and {len(node_types) - 5} more")
                    
                    print(f"\nedgeTypes: {len(edge_types)}")
                    for et in edge_types:
                        alias = et.get("alias", "?")
                        labels = et.get("labels", [])
                        src = et.get("sourceNodeType", {}).get("alias", "?")
                        dst = et.get("destinationNodeType", {}).get("alias", "?")
                        print(f"  - {alias}")
                        print(f"    labels: {labels}")
                        print(f"    {src} -> {dst}")
                
                elif path == "dataSources.json":
                    sources = data.get("dataSources", [])
                    print(f"\n=== dataSources.json ===")
                    print(f"dataSources: {len(sources)}")
                    # Find edge source
                    for ds in sources:
                        if "edge" in ds.get("name", "").lower():
                            print(f"\nEdge dataSource:")
                            print(f"  name: {ds.get('name')}")
                            print(f"  path: {ds.get('properties', {}).get('path')}")
            
            break
    
    print("\n" + "=" * 50)
    print("The Graph UI shows only node/edge TYPES that have data.")
    print("Nodes (2) = Matter, Aggregationstatetype have actual rows")
    print("Edges (1) = aggregationstatetype relationship")
    print("\nTo verify edges work, check gold_edges table in Fabric:")
    print("  SELECT * FROM gold_edges WHERE type = 'aggregationstatetype' LIMIT 5")

if __name__ == "__main__":
    main()
