"""
Check if Fabric Graph has nodes/edges via executeQuery API.

This script:
1. Lists GraphModel items in the workspace
2. Executes a simple query to count nodes
3. Executes a simple query to count edges

Run: python research/check_graph_data.py
"""

import requests
import json
import subprocess
from datetime import datetime

WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"

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
    
    def post(self, endpoint, data=None, timeout=30):
        url = f"{self.base_url}/{endpoint}"
        try:
            resp = requests.post(url, headers=self.headers, json=data or {}, timeout=timeout)
            return resp
        except requests.exceptions.Timeout:
            return None


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "✅", "ERR": "❌", "WARN": "⚠️", "INFO": "ℹ️"}.get(level, "  ")
    print(f"[{ts}] {prefix} {msg}")


def main():
    api = FabricAPI()
    
    print("=" * 70)
    print("FABRIC GRAPH DATA CHECK")
    print("=" * 70)
    
    # ──────────────────────────────────────────────────────────────────
    # Step 1: Find GraphModel items
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 1: Find GraphModel items ---")
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items")
    if resp.status_code != 200:
        log(f"Failed to list items: {resp.status_code} {resp.text}", "ERR")
        return
    
    items = resp.json().get("value", [])
    graph_models = [i for i in items if i.get("type") == "GraphModel"]
    
    if not graph_models:
        log("No GraphModel items found in workspace!", "ERR")
        
        # Check for other Graph-related types
        all_types = set(i.get("type") for i in items)
        print(f"  Available item types: {sorted(all_types)}")
        return
    
    log(f"Found {len(graph_models)} GraphModel(s):", "OK")
    for gm in graph_models:
        print(f"  - {gm['displayName']} ({gm['id']})")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 2: Query each GraphModel for data
    # ──────────────────────────────────────────────────────────────────
    for gm in graph_models:
        gm_id = gm["id"]
        gm_name = gm["displayName"]
        
        print(f"\n--- Checking: {gm_name} ---")
        
        # Query 1: Get all nodes (limited)
        print("\n  Query 1: MATCH (n) RETURN n LIMIT 10")
        resp = api.post(
            f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/executeQuery?beta=true",
            {"query": "MATCH (n) RETURN n LIMIT 10"}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            rows = result.get("results", {}).get("rows", [])
            log(f"Nodes returned: {len(rows)}", "OK" if rows else "WARN")
            if rows:
                print(f"  Sample node: {json.dumps(rows[0], indent=4)[:500]}...")
        elif resp.status_code == 202:
            # LRO - need to poll
            op_url = resp.headers.get("Location")
            log(f"Query returned 202 (LRO) - Location: {op_url}", "INFO")
        else:
            log(f"Query failed: {resp.status_code}", "ERR")
            print(f"  Response: {resp.text[:500]}")
        
        # Query 2: Count all nodes
        print("\n  Query 2: MATCH (n) RETURN count(n) as node_count")
        resp = api.post(
            f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/executeQuery?beta=true",
            {"query": "MATCH (n) RETURN count(n) AS node_count"}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            rows = result.get("results", {}).get("rows", [])
            if rows:
                count = rows[0].get("node_count", rows[0])
                log(f"Total nodes: {count}", "OK" if count else "WARN")
            else:
                log("No count returned", "WARN")
                print(f"  Full result: {json.dumps(result, indent=2)}")
        else:
            log(f"Count query failed: {resp.status_code}", "ERR")
            print(f"  Response: {resp.text[:500]}")
        
        # Query 3: Count all edges/relationships
        print("\n  Query 3: MATCH ()-[r]->() RETURN count(r) as edge_count")
        resp = api.post(
            f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/executeQuery?beta=true",
            {"query": "MATCH ()-[r]->() RETURN count(r) AS edge_count"}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            rows = result.get("results", {}).get("rows", [])
            if rows:
                count = rows[0].get("edge_count", rows[0])
                log(f"Total edges: {count}", "OK" if count else "WARN")
            else:
                log("No count returned", "WARN")
                print(f"  Full result: {json.dumps(result, indent=2)}")
        else:
            log(f"Edge count failed: {resp.status_code}", "ERR")
            print(f"  Response: {resp.text[:500]}")
        
        # Query 4: List node labels
        print("\n  Query 4: MATCH (n) RETURN DISTINCT labels(n) LIMIT 20")
        resp = api.post(
            f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/executeQuery?beta=true",
            {"query": "MATCH (n) RETURN DISTINCT labels(n) AS labels LIMIT 20"}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            rows = result.get("results", {}).get("rows", [])
            if rows:
                log(f"Found {len(rows)} distinct label sets", "OK")
                for row in rows[:10]:
                    print(f"    - {row}")
            else:
                log("No labels found", "WARN")
        else:
            log(f"Labels query failed: {resp.status_code}", "ERR")
        
        # Query 5: List edge types
        print("\n  Query 5: MATCH ()-[r]->() RETURN DISTINCT type(r) LIMIT 20")
        resp = api.post(
            f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/executeQuery?beta=true",
            {"query": "MATCH ()-[r]->() RETURN DISTINCT type(r) AS edge_type LIMIT 20"}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            rows = result.get("results", {}).get("rows", [])
            if rows:
                log(f"Found {len(rows)} distinct edge types", "OK")
                for row in rows[:10]:
                    print(f"    - {row}")
            else:
                log("No edge types found", "WARN")
        else:
            log(f"Edge types query failed: {resp.status_code}", "ERR")


if __name__ == "__main__":
    main()
