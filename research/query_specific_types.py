"""
Test queries with specific node types from the ontology.

The generic MATCH (n) failed with "label expression (%) does not match any node type"
Let's try querying specific types we see in the ontology.

Run: python research/query_specific_types.py
"""

import requests
import json
import subprocess

WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
GRAPH_ID = "0d53e078-910d-4704-8b0b-a5eccf58d789"  # Ziekenhuis graph

# Node types from the screenshot
NODE_TYPES = [
    "Quantityvalue", "Transfertype", "Connection", "Geometricentity",
    "Container", "Aggregationstatetype", "Functionalentity", "Interface",
    "Matter", "Scheiden", "Fundering", "Vloeroppervlak", "Funderingswand",
    "Wandafwerking", "Plannedentity", "Ziekenhuis", "Funderingsconstructie"
]

def get_fabric_token():
    result = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    if result.returncode != 0:
        raise Exception(f"Failed to get token: {result.stderr}")
    return result.stdout.strip()


def main():
    token = get_fabric_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    base_url = "https://api.fabric.microsoft.com/v1"
    query_url = f"{base_url}/workspaces/{WORKSPACE_ID}/GraphModels/{GRAPH_ID}/executeQuery?beta=true"
    
    print("=" * 70)
    print("QUERY SPECIFIC NODE TYPES")
    print("=" * 70)
    
    # Test different query patterns
    test_queries = [
        # Try with specific labels
        ("Specific: Container", "MATCH (n:Container) RETURN count(n) AS cnt"),
        ("Specific: Matter", "MATCH (n:Matter) RETURN count(n) AS cnt"),
        ("Specific: Ziekenhuis", "MATCH (n:Ziekenhuis) RETURN count(n) AS cnt"),
        ("Specific: Fundering", "MATCH (n:Fundering) RETURN count(n) AS cnt"),
        
        # Try lowercase (in case of case sensitivity)
        ("Lowercase: container", "MATCH (n:container) RETURN count(n) AS cnt"),
        
        # Try getting all node labels
        ("All labels", "MATCH (n) RETURN DISTINCT labels(n) LIMIT 10"),
        
        # Try edges
        ("All edges", "MATCH ()-[r]->() RETURN count(r) AS cnt"),
        ("Edge types", "MATCH ()-[r]->() RETURN DISTINCT type(r) LIMIT 10"),
    ]
    
    for name, query in test_queries:
        print(f"\n--- {name} ---")
        print(f"  Query: {query}")
        
        try:
            resp = requests.post(query_url, headers=headers, json={"query": query}, timeout=30)
            
            if resp.status_code == 200:
                result = resp.json()
                
                # Check for error in response
                if "status" in result and "code" in result.get("status", {}):
                    status = result["status"]
                    if status.get("code") != "00000":
                        print(f"  ❌ Error: {status.get('description', 'Unknown')}")
                        if "cause" in status:
                            print(f"     Cause: {status['cause'].get('description', '')}")
                        continue
                
                # Success - show results
                rows = result.get("results", {}).get("rows", [])
                if rows:
                    print(f"  ✅ Results: {len(rows)} row(s)")
                    for row in rows[:5]:
                        print(f"     {row}")
                else:
                    print(f"  ⚠️ No rows returned")
                    
            elif resp.status_code == 202:
                print(f"  ℹ️ Async operation (202)")
                location = resp.headers.get("Location")
                print(f"     LRO: {location}")
            else:
                print(f"  ❌ HTTP {resp.status_code}")
                print(f"     {resp.text[:200]}")
                
        except requests.exceptions.Timeout:
            print(f"  ⚠️ Timeout")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    # Also check the gold tables exist in lakehouse
    print("\n" + "=" * 70)
    print("CHECKING DATA SOURCES")
    print("=" * 70)
    
    # Get the GraphModel definition to see data bindings
    print("\n--- Get GraphModel Definition ---")
    def_url = f"{base_url}/workspaces/{WORKSPACE_ID}/GraphModels/{GRAPH_ID}/getDefinition"
    try:
        resp = requests.post(def_url, headers=headers, json={"format": "GraphModelV1"}, timeout=60)
        if resp.status_code == 202:
            location = resp.headers.get("Location")
            print(f"  Definition is LRO: {location}")
            
            # Poll for result
            import time
            for _ in range(20):
                time.sleep(3)
                poll = requests.get(location, headers=headers, timeout=30)
                if poll.status_code == 200:
                    status = poll.json().get("status")
                    print(f"  Status: {status}")
                    if status == "Succeeded":
                        # Get the result
                        result_url = f"{location}/result"
                        result_resp = requests.get(result_url, headers=headers, timeout=30)
                        if result_resp.status_code == 200:
                            definition = result_resp.json()
                            parts = definition.get("definition", {}).get("parts", [])
                            print(f"  Definition has {len(parts)} parts")
                            
                            # Look for data sources
                            for part in parts:
                                path = part.get("path", "")
                                if "DataSource" in path or "dataSource" in path.lower():
                                    print(f"    - {path}")
                        break
                    elif status == "Failed":
                        print(f"  ❌ Definition fetch failed")
                        break
        else:
            print(f"  Got: {resp.status_code}")
    except Exception as e:
        print(f"  Error: {e}")


if __name__ == "__main__":
    main()
