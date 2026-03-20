"""
Examine GraphModel definition to understand why no node types are queryable.

Run: python research/examine_graph_definition.py
"""

import requests
import json
import subprocess
import time

WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
GRAPH_ID = "0d53e078-910d-4704-8b0b-a5eccf58d789"  # Ziekenhuis graph

def get_fabric_token():
    result = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    return result.stdout.strip()


def main():
    token = get_fabric_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    base_url = "https://api.fabric.microsoft.com/v1"
    
    print("=" * 70)
    print("EXAMINE GRAPHMODEL DEFINITION")
    print("=" * 70)
    
    # Get GraphModel definition
    def_url = f"{base_url}/workspaces/{WORKSPACE_ID}/GraphModels/{GRAPH_ID}/getDefinition"
    
    print("\n--- Fetching definition ---")
    resp = requests.post(def_url, headers=headers, json={"format": "GraphModelV1"}, timeout=60)
    
    if resp.status_code != 202:
        print(f"Expected 202, got {resp.status_code}")
        print(resp.text[:500])
        return
    
    location = resp.headers.get("Location")
    print(f"LRO: {location}")
    
    # Poll for completion
    for _ in range(30):
        time.sleep(2)
        poll = requests.get(location, headers=headers, timeout=30)
        if poll.status_code == 200:
            status = poll.json().get("status")
            if status == "Succeeded":
                print("Definition retrieved!")
                break
            elif status == "Failed":
                print(f"Failed: {poll.json()}")
                return
    else:
        print("Timeout waiting for definition")
        return
    
    # Get the result
    result_url = f"{location}/result"
    result_resp = requests.get(result_url, headers=headers, timeout=60)
    
    if result_resp.status_code != 200:
        print(f"Failed to get result: {result_resp.status_code}")
        return
    
    definition = result_resp.json()
    
    # Analyze definition parts
    parts = definition.get("definition", {}).get("parts", [])
    print(f"\n--- Definition has {len(parts)} parts ---")
    
    for part in parts:
        path = part.get("path", "")
        payload = part.get("payload", "")
        
        print(f"\n{'='*50}")
        print(f"Part: {path}")
        print(f"{'='*50}")
        
        # Decode base64 payload
        if payload:
            import base64
            try:
                decoded = base64.b64decode(payload).decode('utf-8')
                
                # Parse as JSON if possible
                try:
                    data = json.loads(decoded)
                    print(json.dumps(data, indent=2)[:3000])
                    
                    # Look for key elements
                    if "nodeTypes" in data:
                        node_types = data.get("nodeTypes", [])
                        print(f"\n  ** Found {len(node_types)} nodeTypes")
                        for nt in node_types[:5]:
                            print(f"     - {nt.get('displayName', nt.get('name', 'N/A'))}")
                            if 'dataBinding' in nt:
                                print(f"       dataBinding: {nt['dataBinding']}")
                        if len(node_types) > 5:
                            print(f"     ... and {len(node_types)-5} more")
                            
                    if "edgeTypes" in data:
                        edge_types = data.get("edgeTypes", [])
                        print(f"\n  ** Found {len(edge_types)} edgeTypes")
                        
                    if "dataSources" in data:
                        data_sources = data.get("dataSources", [])
                        print(f"\n  ** Found {len(data_sources)} dataSources")
                        for ds in data_sources[:10]:
                            print(f"     - {ds.get('name', 'N/A')}: {ds.get('type', 'N/A')}")
                            
                except json.JSONDecodeError:
                    print(decoded[:2000])
            except Exception as e:
                print(f"Could not decode: {e}")
    
    print("\n" + "=" * 70)
    print("ANALYSIS COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
