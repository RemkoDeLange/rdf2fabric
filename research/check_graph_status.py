"""
Quick check of GraphModel status and trigger refresh if needed.

The issue: Model view shows 35 node types with data bindings,
but Query view shows 0 nodes, 0 edges.

This suggests:
1. The graph model (ontology + bindings) exists
2. But data hasn't been materialized into the graph yet
3. Need to trigger RefreshGraph job

Run: python research/check_graph_status.py
"""

import requests
import json
import subprocess
import time
from datetime import datetime

WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
# The Ziekenhuis graph from your screenshot
TARGET_GRAPH_NAME = "Ziekenhuis_lvl4_v1_Ontology_graph_16cd0364a3a84bb39b5bcb380284d1e6"

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
    
    def get(self, endpoint, timeout=30):
        url = f"{self.base_url}/{endpoint}"
        try:
            resp = requests.get(url, headers=self.headers, timeout=timeout)
            return resp
        except requests.exceptions.Timeout:
            return None
    
    def post(self, endpoint, data=None, timeout=30):
        url = f"{self.base_url}/{endpoint}"
        try:
            resp = requests.post(url, headers=self.headers, json=data or {}, timeout=timeout)
            return resp
        except requests.exceptions.Timeout:
            return None
    
    def wait_for_lro(self, operation_url, timeout=120):
        """Poll LRO until complete."""
        start = time.time()
        while time.time() - start < timeout:
            try:
                resp = requests.get(operation_url, headers=self.headers, timeout=30)
                if resp.status_code != 200:
                    return {"status": "Error", "error": resp.text}
                result = resp.json()
                status = result.get("status", "Unknown")
                print(f"  ... LRO status: {status}")
                if status in ("Succeeded", "Failed"):
                    return result
                time.sleep(3)
            except Exception as e:
                return {"status": "Error", "error": str(e)}
        return {"status": "Timeout"}


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "✅", "ERR": "❌", "WARN": "⚠️", "INFO": "ℹ️"}.get(level, "  ")
    print(f"[{ts}] {prefix} {msg}")


def main():
    api = FabricAPI()
    
    print("=" * 70)
    print("FABRIC GRAPH STATUS CHECK")
    print("=" * 70)
    
    # ──────────────────────────────────────────────────────────────────
    # Step 1: Find the GraphModel
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Step 1: Find GraphModel ---")
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items")
    if not resp or resp.status_code != 200:
        log("Failed to list items", "ERR")
        return
    
    items = resp.json().get("value", [])
    graph_model = None
    
    for item in items:
        if item.get("type") == "GraphModel":
            name = item.get("displayName", "")
            print(f"  Found: {name}")
            if TARGET_GRAPH_NAME in name or name == TARGET_GRAPH_NAME:
                graph_model = item
                log(f"Target graph found: {name}", "OK")
    
    if not graph_model:
        log(f"Could not find graph: {TARGET_GRAPH_NAME}", "ERR")
        # Use first graph model
        for item in items:
            if item.get("type") == "GraphModel":
                graph_model = item
                log(f"Using first GraphModel: {item['displayName']}", "WARN")
                break
    
    if not graph_model:
        log("No GraphModel found!", "ERR")
        return
    
    gm_id = graph_model["id"]
    gm_name = graph_model["displayName"]
    
    # ──────────────────────────────────────────────────────────────────
    # Step 2: Get GraphModel details
    # ──────────────────────────────────────────────────────────────────
    print(f"\n--- Step 2: GraphModel details for {gm_name} ---")
    resp = api.get(f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}")
    if resp and resp.status_code == 200:
        log("GraphModel info:", "OK")
        print(json.dumps(resp.json(), indent=2))
    else:
        log(f"Could not get details: {resp.status_code if resp else 'timeout'}", "WARN")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 3: Check recent jobs
    # ──────────────────────────────────────────────────────────────────
    print(f"\n--- Step 3: Check job history ---")
    
    # Try different job endpoints
    job_endpoints = [
        f"workspaces/{WORKSPACE_ID}/items/{gm_id}/jobs/instances",
        f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/jobs/instances",
    ]
    
    for ep in job_endpoints:
        resp = api.get(ep)
        if resp and resp.status_code == 200:
            jobs = resp.json().get("value", [])
            log(f"Found {len(jobs)} jobs at {ep.split('/')[-2]}", "OK")
            for job in jobs[:5]:
                print(f"  - {job.get('jobType')}: {job.get('status')} ({job.get('startTimeUtc', 'N/A')})")
            break
        else:
            log(f"No jobs at {ep}: {resp.status_code if resp else 'timeout'}")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 4: Trigger RefreshGraph job
    # ──────────────────────────────────────────────────────────────────
    print(f"\n--- Step 4: Trigger RefreshGraph ---")
    
    log("Triggering RefreshGraph job...")
    
    # Try GraphModel-specific endpoint
    refresh_endpoints = [
        f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/jobs/instances?jobType=RefreshGraph",
        f"workspaces/{WORKSPACE_ID}/items/{gm_id}/jobs/instances?jobType=RefreshGraph",
    ]
    
    for ep in refresh_endpoints:
        resp = api.post(ep, {})
        if resp:
            log(f"POST {ep.split('?')[0]}: {resp.status_code}")
            
            if resp.status_code == 202:
                log("RefreshGraph job started!", "OK")
                location = resp.headers.get("Location")
                if location:
                    log(f"Waiting for completion...")
                    result = api.wait_for_lro(location)
                    log(f"RefreshGraph result: {result.get('status')}", 
                        "OK" if result.get("status") == "Succeeded" else "ERR")
                break
            elif resp.status_code == 200:
                log("RefreshGraph completed synchronously!", "OK")
                print(f"  Response: {resp.text[:500]}")
                break
            else:
                print(f"  Response: {resp.text[:300]}")
        else:
            log(f"Timeout on {ep}", "WARN")
    
    # ──────────────────────────────────────────────────────────────────
    # Step 5: Simple query test (with timeout)
    # ──────────────────────────────────────────────────────────────────
    print(f"\n--- Step 5: Simple query test ---")
    
    log("Executing: MATCH (n) RETURN count(n) as cnt")
    resp = api.post(
        f"workspaces/{WORKSPACE_ID}/GraphModels/{gm_id}/executeQuery?beta=true",
        {"query": "MATCH (n) RETURN count(n) AS cnt"},
        timeout=60
    )
    
    if not resp:
        log("Query timed out", "WARN")
    elif resp.status_code == 200:
        result = resp.json()
        rows = result.get("results", {}).get("rows", [])
        if rows:
            count = rows[0].get("cnt", rows[0])
            log(f"Node count: {count}", "OK" if count else "WARN")
        else:
            log("No results", "WARN")
            print(f"  Full response: {json.dumps(result, indent=2)[:500]}")
    elif resp.status_code == 202:
        log("Query is async (LRO)", "INFO")
        location = resp.headers.get("Location")
        if location:
            result = api.wait_for_lro(location, timeout=60)
            print(f"  LRO result: {json.dumps(result, indent=2)[:500]}")
    else:
        log(f"Query failed: {resp.status_code}", "ERR")
        print(f"  Response: {resp.text[:500]}")
    
    print("\n" + "=" * 70)
    print("DONE")
    print("=" * 70)


if __name__ == "__main__":
    main()
