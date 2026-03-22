#!/usr/bin/env python3
"""
Check Binding Status for Operatiekamer Entity
==============================================
Quick script to inspect the data binding configuration via Fabric API.

Run: python research/check_binding_status.py
"""

import requests
import json
import base64
import subprocess
import time
from datetime import datetime

# ============================================================================
# CONFIG
# ============================================================================
WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
ONTOLOGY_NAME = "Ziekenhuis_lvl4_v2_Ontology"
FABRIC_API = "https://api.fabric.microsoft.com/v1"
LRO_TIMEOUT_SEC = 120

# ============================================================================
# UTILITIES
# ============================================================================
def log(msg, level="INFO"):
    ts = datetime.now().strftime('%H:%M:%S')
    colors = {"OK": "\033[92m", "FAIL": "\033[91m", "WARN": "\033[93m", "INFO": "\033[94m"}
    color = colors.get(level, "")
    print(f"{color}[{ts}] {msg}\033[0m")

def get_token():
    result = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    if result.returncode != 0:
        raise Exception(f"Token error: {result.stderr}")
    return result.stdout.strip()

def b64dec(payload: str) -> dict:
    return json.loads(base64.b64decode(payload).decode())

def get_definition(token, item_type, item_id):
    """Get definition via LRO → /result pattern."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    resp = requests.post(
        f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/{item_type}/{item_id}/getDefinition",
        headers=headers, json={}, timeout=60
    )
    
    if resp.status_code == 200:
        return resp.json()
    
    if resp.status_code != 202:
        log(f"getDefinition: {resp.status_code} {resp.text[:200]}", "FAIL")
        return None

    op_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
    if not op_url:
        return None

    log("Waiting for definition LRO...")
    start = time.time()
    while time.time() - start < LRO_TIMEOUT_SEC:
        time.sleep(3)
        r = requests.get(op_url, headers=headers, timeout=60)
        if r.status_code != 200:
            continue
        result = r.json()
        status = result.get("status", "Unknown")
        if status in ("Succeeded", "Completed"):
            r2 = requests.get(f"{op_url}/result", headers=headers, timeout=60)
            if r2.status_code == 200:
                return r2.json()
            return None
        elif status in ("Failed", "Cancelled"):
            log(f"LRO failed: {status}", "FAIL")
            return None
    return None


def main():
    print("\n" + "="*70)
    print("CHECK BINDING STATUS FOR OPERATIEKAMER")
    print("="*70 + "\n")

    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Find ontology
    resp = requests.get(f"{FABRIC_API}/workspaces/{WORKSPACE_ID}/items", headers=headers)
    items = resp.json().get("value", [])
    
    ontology = None
    for item in items:
        if item["type"] == "Ontology" and ONTOLOGY_NAME in item["displayName"]:
            ontology = item
            break
    
    if not ontology:
        log(f"Ontology '{ONTOLOGY_NAME}' not found", "FAIL")
        log("Available ontologies:")
        for item in items:
            if item["type"] == "Ontology":
                log(f"  - {item['displayName']}")
        return

    log(f"Found ontology: {ontology['displayName']} ({ontology['id']})", "OK")

    # Get definition
    log("Fetching ontology definition...")
    defn = get_definition(token, "ontologies", ontology["id"])
    if not defn:
        log("Could not get definition", "FAIL")
        return

    parts = defn.get("definition", {}).get("parts", [])
    log(f"Definition has {len(parts)} parts")

    # Find Operatiekamer entity and its bindings
    operatiekamer_id = None
    operatiekamer_props = []
    all_bindings = []

    print("\n" + "-"*50)
    print("ENTITY TYPES")
    print("-"*50)

    for p in parts:
        path = p.get("path", "")
        try:
            payload = b64dec(p["payload"])
        except:
            continue

        if "/definition.json" in path and "EntityTypes/" in path:
            name = payload.get("name", "?")
            eid = payload.get("id", "?")
            props = payload.get("properties", [])
            
            if "Operatiekamer" in name:
                operatiekamer_id = eid
                operatiekamer_props = props
                log(f"★ {name} (id={eid}, props={len(props)})", "OK")
                for prop in props:
                    print(f"    - {prop.get('name')}: {prop.get('valueType')} (id={prop.get('id')})")

    print("\n" + "-"*50)
    print("DATA BINDINGS")
    print("-"*50)

    for p in parts:
        path = p.get("path", "")
        try:
            payload = b64dec(p["payload"])
        except:
            continue

        if "DataBindings/" in path or "Contextualizations/" in path:
            all_bindings.append({"path": path, "data": payload})
            
            # Check if this is for Operatiekamer (by path or entityTypeId)
            is_operatiekamer = "Operatiekamer" in path or payload.get("entityTypeId") == operatiekamer_id
            
            if is_operatiekamer:
                print(f"\n★ OPERATIEKAMER BINDING: {path}")
                print(json.dumps(payload, indent=2))

    print("\n" + "-"*50)
    print("BINDING SUMMARY")
    print("-"*50)
    
    # Count binding types
    timeseries_bindings = []
    static_bindings = []
    
    for b in all_bindings:
        config = b["data"].get("dataBindingConfiguration", {})
        binding_type = config.get("dataBindingType", "Unknown")
        if binding_type == "TimeSeries":
            timeseries_bindings.append(b)
        else:
            static_bindings.append(b)

    log(f"Total bindings: {len(all_bindings)}")
    log(f"  Static (NonTimeSeries): {len(static_bindings)}")
    log(f"  TimeSeries: {len(timeseries_bindings)}")

    # Show all timeseries bindings
    if timeseries_bindings:
        print("\n" + "-"*50)
        print("ALL TIMESERIES BINDINGS")
        print("-"*50)
        for b in timeseries_bindings:
            print(f"\nPath: {b['path']}")
            print(json.dumps(b["data"], indent=2))


if __name__ == "__main__":
    main()
