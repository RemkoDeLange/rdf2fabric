"""
Fabric Graph Materialization Research Script
=============================================
Investigate why the Graph connected to our Ontology is empty.

Steps:
1. List all workspace items to find Graph-related items
2. Check Ontology properties for connected Graph reference
3. Attempt to trigger RefreshGraph on the connected Graph
4. Check Graph status

Run: python research/graph_refresh_research.py
"""

import requests
import json
import subprocess
import time
from datetime import datetime


WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
LAKEHOUSE_ID = "32e17923-0b8b-4106-953a-6d63081fa361"
ONTOLOGY_NAME = "RDF_Translated_Ontology"

def get_fabric_token():
    """Get Fabric API token using Azure CLI."""
    result = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    if result.returncode != 0:
        raise Exception(f"Failed to get token: {result.stderr}")
    return result.stdout.strip()


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
    
    def post(self, endpoint, data=None):
        url = f"{self.base_url}/{endpoint}"
        resp = requests.post(url, headers=self.headers, json=data or {})
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
            if status in ("Succeeded", "Failed"):
                return result
            time.sleep(2)
        return {"status": "Timeout"}


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "✅", "ERR": "❌", "WARN": "⚠️", "INFO": "ℹ️"}.get(level, "  ")
    print(f"[{ts}] {prefix} {msg}")


def main():
    api = FabricAPI()
    
    print("=" * 70)
    print("FABRIC GRAPH MATERIALIZATION RESEARCH")
    print("=" * 70)
    
    # ──────────────────────────────────────────────────────────────────
    # Step 1: List ALL workspace items
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 1: List all workspace items ---")
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items")
    if resp.status_code != 200:
        log(f"Failed to list items: {resp.status_code} {resp.text}", "ERR")
        return
    
    items = resp.json().get("value", [])
    log(f"Found {len(items)} items in workspace")
    
    # Group by type
    types = {}
    ontology_item = None
    graph_items = []
    
    for item in items:
        item_type = item.get("type", "Unknown")
        types.setdefault(item_type, []).append(item)
        
        if item_type == "Ontology" and item.get("displayName") == ONTOLOGY_NAME:
            ontology_item = item
        
        # Look for Graph-related items
        if item_type in ("GraphQLApi", "Graph", "GraphModel", "GraphQLEndpoint"):
            graph_items.append(item)
    
    print("\n  Item types in workspace:")
    for t, items_of_type in sorted(types.items()):
        print(f"    {t}: {len(items_of_type)}")
        for it in items_of_type:
            print(f"      - {it.get('displayName', 'N/A')} ({it.get('id', 'N/A')})")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 2: Check Ontology item details
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 2: Check Ontology item ---")
    if ontology_item:
        log(f"Found ontology: {ontology_item['displayName']} ({ontology_item['id']})", "OK")
        print(f"  Full item: {json.dumps(ontology_item, indent=2)}")
        
        # Get full ontology details
        ontology_id = ontology_item["id"]
        resp2 = api.get(f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}")
        if resp2.status_code == 200:
            log("Ontology details:", "OK")
            print(f"  {json.dumps(resp2.json(), indent=2)}")
        else:
            log(f"Could not get ontology details: {resp2.status_code}", "WARN")
    else:
        log(f"Ontology '{ONTOLOGY_NAME}' not found!", "ERR")
        # List all ontologies
        ontology_items = types.get("Ontology", [])
        for o in ontology_items:
            print(f"  Available: {o.get('displayName')} ({o.get('id')})")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 3: Find Graph items
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 3: Graph-related items ---")
    if graph_items:
        for gi in graph_items:
            log(f"Found: {gi['type']} - {gi.get('displayName', 'N/A')} ({gi.get('id', 'N/A')})", "OK")
            print(f"  Full item: {json.dumps(gi, indent=2)}")
    else:
        log("No Graph/GraphModel/GraphQLApi items found in workspace", "WARN")
        log("Checking all item types that might be graph-related...", "INFO")
        for item in items:
            name = item.get("displayName", "").lower()
            if "graph" in name or "ontology" in name.lower():
                print(f"  Candidate: {item.get('type')} - {item.get('displayName')} ({item.get('id')})")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 4: Try GraphQL API endpoints  
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 4: Try GraphQL API endpoints ---")
    
    # Try listing GraphQL APIs (different endpoint)
    for api_path in [
        f"workspaces/{WORKSPACE_ID}/graphqlApis",
        f"workspaces/{WORKSPACE_ID}/GraphQLApis",
    ]:
        resp = api.get(api_path)
        log(f"GET {api_path}: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"  Response: {json.dumps(data, indent=2)}", "OK")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 5: Try Ontology-specific endpoints for graph connection
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 5: Try Ontology graph-related endpoints ---")
    
    if ontology_item:
        ontology_id = ontology_item["id"]
        
        # Try various potential endpoints
        test_endpoints = [
            # Ontology jobs
            f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}/jobs",
            # Ontology graph connection
            f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}/graph",
            # Ontology refresh  
            f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}/jobs/instances",
            # Generic item jobs
            f"workspaces/{WORKSPACE_ID}/items/{ontology_id}/jobs",
        ]
        
        for ep in test_endpoints:
            resp = api.get(ep)
            log(f"GET {ep}: {resp.status_code}")
            if resp.status_code == 200:
                print(f"  Response: {json.dumps(resp.json(), indent=2)}")
            elif resp.status_code != 404:
                print(f"  Response: {resp.text[:200]}")

    # ──────────────────────────────────────────────────────────────────
    # Step 6: Try to trigger graph refresh via RunOnDemandItemJob
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 6: Try RunOnDemandItemJob for Ontology ---")
    
    if ontology_item:
        ontology_id = ontology_item["id"]
        
        # The generic Fabric job endpoint
        job_endpoints = [
            (f"workspaces/{WORKSPACE_ID}/items/{ontology_id}/jobs/instances?jobType=RefreshGraph", "RefreshGraph"),
            (f"workspaces/{WORKSPACE_ID}/items/{ontology_id}/jobs/instances?jobType=DefaultJob", "DefaultJob"),
            (f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}/jobs/instances?jobType=RefreshGraph", "RefreshGraph (ontology)"),
        ]
        
        for ep, desc in job_endpoints:
            log(f"POST {desc}: {ep}")
            resp = api.post(ep)
            log(f"  Status: {resp.status_code}")
            if resp.status_code in (200, 202):
                log(f"  Job triggered!", "OK")
                # Check for LRO
                location = resp.headers.get("Location")
                if location:
                    log(f"  LRO: {location}")
                    lro_result = api.wait_for_lro(location)
                    log(f"  LRO result: {json.dumps(lro_result, indent=2)}")
                else:
                    print(f"  Response: {resp.text[:500]}")
            else:
                print(f"  Response: {resp.text[:300]}")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 7: If we found any Graph items, try RefreshGraph on them
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 7: RefreshGraph on any Graph items ---")
    
    # Also try all items that might be Graph-like
    potential_graph_types = ["GraphQLApi", "Graph", "GraphModel"]
    all_potential = [i for i in items if i.get("type") in potential_graph_types]
    
    # Also check for connected items named similar to the ontology
    for item in items:
        if item.get("type") not in ("Ontology", "Lakehouse", "Notebook", "SQLEndpoint", "Dataset"):
            name = item.get("displayName", "")
            if "RDF" in name or "Translated" in name or "Ontology" in name or "graph" in name.lower():
                if item not in all_potential:
                    all_potential.append(item)
    
    if all_potential:
        for gi in all_potential:
            gid = gi["id"]
            gtype = gi["type"]
            gname = gi.get("displayName", "N/A")
            log(f"Trying RefreshGraph on {gtype}: {gname} ({gid})")
            
            # Try item-level job
            resp = api.post(f"workspaces/{WORKSPACE_ID}/items/{gid}/jobs/instances?jobType=RefreshGraph")
            log(f"  Status: {resp.status_code}")
            if resp.status_code in (200, 202):
                log(f"  RefreshGraph triggered!", "OK")
                location = resp.headers.get("Location")
                if location:
                    log(f"  LRO: {location}")
                    lro_result = api.wait_for_lro(location, timeout=300)
                    log(f"  LRO result: {json.dumps(lro_result, indent=2)}")
            else:
                print(f"  Response: {resp.text[:300]}")
    else:
        log("No Graph-like items found to refresh", "WARN")
    
    # ──────────────────────────────────────────────────────────────────
    # Summary
    # ──────────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Workspace items: {len(items)}")
    print(f"Item types: {list(types.keys())}")
    print(f"Ontology found: {'Yes' if ontology_item else 'No'}")
    print(f"Graph items found: {len(graph_items)}")
    if ontology_item:
        print(f"Ontology ID: {ontology_item['id']}")


if __name__ == "__main__":
    main()
