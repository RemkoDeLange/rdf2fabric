#!/usr/bin/env python3
"""
RefreshGraph Workaround Research Script
========================================
Product group suggestion: Rename a property via UI/API to trigger an ontology
binding update, which may cause the Graph Refresh to actually run.

This script has 3 phases:
  Phase 1: Inspect current state & clean up (delete ontology + GraphModel)
  Phase 2: After re-running NB01-NB09, inspect the fresh ontology
  Phase 3: Try the rename workaround via API, then trigger RefreshGraph

Run:
  python research/refresh_workaround.py --phase 1   # Clean up
  python research/refresh_workaround.py --phase 2   # Inspect after re-run
  python research/refresh_workaround.py --phase 3   # Try rename workaround
"""

import requests
import json
import base64
import subprocess
import time
import sys
from datetime import datetime
from typing import Optional, Dict, List, Any

# ============================================================================
# CONFIG
# ============================================================================
WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
LAKEHOUSE_ID = "32e17923-0b8b-4106-953a-6d63081fa361"
ONTOLOGY_NAME = "RDF_Translated_Ontology"
FABRIC_API = "https://api.fabric.microsoft.com/v1"
LRO_POLL_SEC = 3
LRO_TIMEOUT_SEC = 180

# ============================================================================
# UTILITIES
# ============================================================================
class C:
    OK = "\033[92m"; FAIL = "\033[91m"; WARN = "\033[93m"
    INFO = "\033[94m"; BOLD = "\033[1m"; END = "\033[0m"

def log(msg, level="INFO"):
    ts = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    color = {"OK": C.OK, "FAIL": C.FAIL, "WARN": C.WARN, "INFO": C.INFO}.get(level, "")
    print(f"{color}[{ts}] [{level}] {msg}{C.END}")


class FabricAPI:
    def __init__(self):
        self.token = self._get_token()

    def _get_token(self):
        result = subprocess.run(
            "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
            capture_output=True, text=True, shell=True
        )
        if result.returncode != 0:
            raise Exception(f"Token error: {result.stderr}")
        return result.stdout.strip()

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def get(self, endpoint):
        return requests.get(f"{FABRIC_API}/{endpoint}", headers=self.headers, timeout=60)

    def post(self, endpoint, data=None):
        return requests.post(f"{FABRIC_API}/{endpoint}", headers=self.headers, json=data or {}, timeout=120)

    def patch(self, endpoint, data=None):
        return requests.patch(f"{FABRIC_API}/{endpoint}", headers=self.headers, json=data or {}, timeout=60)

    def delete(self, endpoint):
        return requests.delete(f"{FABRIC_API}/{endpoint}", headers=self.headers, timeout=60)

    def wait_lro(self, resp, label="operation"):
        if resp.status_code in (200, 201):
            return resp.json() if resp.text else {}
        if resp.status_code != 202:
            log(f"LRO {label}: unexpected {resp.status_code} {resp.text[:300]}", "WARN")
            return None

        op_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        if not op_url:
            time.sleep(5)
            return {"status": "Completed"}

        log(f"LRO started for {label}...")
        start = time.time()
        while time.time() - start < LRO_TIMEOUT_SEC:
            time.sleep(LRO_POLL_SEC)
            r = requests.get(op_url, headers=self.headers, timeout=60)
            if r.status_code != 200:
                continue
            result = r.json()
            status = result.get("status", "Unknown")
            if status in ("Succeeded", "Completed"):
                log(f"LRO {label}: {status}", "OK")
                return result
            elif status in ("Failed", "Cancelled"):
                log(f"LRO {label}: {status} - {result.get('error', result.get('failureReason', 'no detail'))}", "FAIL")
                return result
            else:
                log(f"LRO {label}: {status} ({int(time.time()-start)}s)")
        log(f"LRO {label} timed out", "FAIL")
        return {"status": "Timeout"}

    def get_definition(self, item_type: str, item_id: str) -> Optional[dict]:
        """Get definition via LRO → /result pattern."""
        resp = self.post(f"workspaces/{WORKSPACE_ID}/{item_type}/{item_id}/getDefinition", {})
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code != 202:
            log(f"getDefinition: {resp.status_code} {resp.text[:200]}", "FAIL")
            return None

        op_url = resp.headers.get("Location") or resp.headers.get("Operation-Location")
        if not op_url:
            return None

        start = time.time()
        while time.time() - start < LRO_TIMEOUT_SEC:
            time.sleep(LRO_POLL_SEC)
            r = requests.get(op_url, headers=self.headers, timeout=60)
            if r.status_code != 200:
                continue
            result = r.json()
            status = result.get("status", "Unknown")
            if status in ("Succeeded", "Completed"):
                r2 = requests.get(f"{op_url}/result", headers=self.headers, timeout=60)
                if r2.status_code == 200:
                    return r2.json()
                log(f"/result returned {r2.status_code}", "WARN")
                return None
            elif status in ("Failed", "Cancelled"):
                log(f"getDefinition LRO: {status}", "FAIL")
                return None
        return None


def b64dec(payload: str) -> dict:
    return json.loads(base64.b64decode(payload).decode())

def b64enc(data) -> str:
    return base64.b64encode(json.dumps(data).encode()).decode()


# ============================================================================
# PHASE 1: Inspect & Clean Up
# ============================================================================
def phase_1_cleanup(api: FabricAPI):
    print(f"\n{'='*70}")
    print(f"PHASE 1: INSPECT CURRENT STATE & CLEAN UP")
    print(f"{'='*70}\n")

    # List all items
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items")
    if resp.status_code != 200:
        log(f"Failed to list items: {resp.status_code}", "FAIL")
        return
    items = resp.json().get("value", [])

    ontologies = [i for i in items if i["type"] == "Ontology"]
    graph_models = [i for i in items if i["type"] == "GraphModel"]

    log(f"Workspace items: {len(items)} total")
    log(f"  Ontologies: {len(ontologies)}")
    for o in ontologies:
        log(f"    - {o['displayName']} ({o['id']})")
    log(f"  GraphModels: {len(graph_models)}")
    for g in graph_models:
        log(f"    - {g['displayName']} ({g['id']})")

    # Inspect existing ontology definition
    for ont in ontologies:
        log(f"\nInspecting ontology: {ont['displayName']}")
        defn = api.get_definition("ontologies", ont["id"])
        if defn:
            parts = defn.get("definition", {}).get("parts", [])
            log(f"  Definition parts: {len(parts)}")
            entity_count = 0
            rel_count = 0
            binding_count = 0
            for p in parts:
                path = p.get("path", "")
                if "/definition.json" in path and "EntityTypes/" in path:
                    entity_count += 1
                    try:
                        payload = b64dec(p["payload"])
                        log(f"    Entity: {payload.get('name', '?')} (id={payload.get('id', '?')}, props={len(payload.get('properties', []))})")
                    except:
                        pass
                elif "/definition.json" in path and "RelationshipTypes/" in path:
                    rel_count += 1
                elif "DataBindings/" in path:
                    binding_count += 1
                elif "Contextualizations/" in path:
                    binding_count += 1
            log(f"  Summary: {entity_count} entity types, {rel_count} relationships, {binding_count} bindings")
        else:
            log(f"  Could not retrieve definition", "WARN")

    # Delete
    print(f"\n{'─'*50}")
    print("CLEANUP: Will delete all ontologies and GraphModels")
    print(f"{'─'*50}")

    # Delete GraphModels first (they depend on ontology)
    for g in graph_models:
        log(f"Deleting GraphModel: {g['displayName']} ({g['id']})")
        resp = api.delete(f"workspaces/{WORKSPACE_ID}/items/{g['id']}")
        if resp.status_code in (200, 204):
            log(f"  Deleted", "OK")
        elif resp.status_code == 202:
            api.wait_lro(resp, f"delete GraphModel {g['displayName']}")
        else:
            log(f"  Delete returned {resp.status_code}: {resp.text[:200]}", "WARN")
        time.sleep(2)

    # Delete Ontologies
    for o in ontologies:
        log(f"Deleting Ontology: {o['displayName']} ({o['id']})")
        resp = api.delete(f"workspaces/{WORKSPACE_ID}/items/{o['id']}")
        if resp.status_code in (200, 204):
            log(f"  Deleted", "OK")
        elif resp.status_code == 202:
            api.wait_lro(resp, f"delete Ontology {o['displayName']}")
        else:
            log(f"  Delete returned {resp.status_code}: {resp.text[:200]}", "WARN")
        time.sleep(2)

    # Verify
    time.sleep(5)
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items")
    items = resp.json().get("value", [])
    remaining_ont = [i for i in items if i["type"] == "Ontology"]
    remaining_gm = [i for i in items if i["type"] == "GraphModel"]
    log(f"\nAfter cleanup: {len(remaining_ont)} ontologies, {len(remaining_gm)} GraphModels")

    if not remaining_ont and not remaining_gm:
        log("Clean slate achieved!", "OK")
        print(f"\n{'='*70}")
        print("NEXT STEPS:")
        print("  1. Re-run notebooks in Fabric: NB01 → NB02 → NB03 → NB04 → NB05 → NB06 → NB07 → NB08 → NB09")
        print("  2. Then run: python research/refresh_workaround.py --phase 2")
        print(f"{'='*70}")
    else:
        log("Some items remain — may need manual deletion in Fabric portal", "WARN")


# ============================================================================
# PHASE 2: Inspect fresh ontology after notebook re-run
# ============================================================================
def phase_2_inspect(api: FabricAPI):
    print(f"\n{'='*70}")
    print(f"PHASE 2: INSPECT FRESH ONTOLOGY")
    print(f"{'='*70}\n")

    # Find ontology
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items")
    items = resp.json().get("value", [])

    ontologies = [i for i in items if i["type"] == "Ontology"]
    graph_models = [i for i in items if i["type"] == "GraphModel"]

    if not ontologies:
        log("No ontologies found — run NB07→NB08→NB09 first", "FAIL")
        return

    log(f"Ontologies: {len(ontologies)}")
    for o in ontologies:
        log(f"  - {o['displayName']} ({o['id']})")

    log(f"GraphModels: {len(graph_models)}")
    for g in graph_models:
        log(f"  - {g['displayName']} ({g['id']})")

    # Get ontology definition
    ont = ontologies[0]
    ontology_id = ont["id"]
    log(f"\nFetching definition for: {ont['displayName']}")

    defn = api.get_definition("ontologies", ontology_id)
    if not defn:
        log("Could not get ontology definition", "FAIL")
        return

    parts = defn.get("definition", {}).get("parts", [])
    entity_types = []
    relationships = []
    bindings = []

    for p in parts:
        path = p.get("path", "")
        try:
            payload = b64dec(p["payload"])
        except:
            continue

        if "/definition.json" in path and "EntityTypes/" in path:
            entity_types.append({"path": path, "data": payload})
            log(f"  Entity: {payload.get('name', '?')} (id={payload.get('id', '?')}, "
                f"props={len(payload.get('properties', []))})")
        elif "/definition.json" in path and "RelationshipTypes/" in path:
            relationships.append({"path": path, "data": payload})
        elif "DataBindings/" in path:
            bindings.append({"path": path, "data": payload})
        elif "Contextualizations/" in path:
            bindings.append({"path": path, "data": payload})

    log(f"\nSummary: {len(entity_types)} entities, {len(relationships)} relationships, {len(bindings)} bindings")

    if entity_types:
        log(f"\nEntity types with properties (candidates for rename):")
        for et in entity_types:
            d = et["data"]
            props = d.get("properties", [])
            log(f"  {d.get('name', '?')}:")
            for prop in props:
                log(f"    - {prop.get('name', '?')} (id={prop.get('id', '?')}, type={prop.get('valueType', '?')})")

    # Check GraphModel definition
    if graph_models:
        gm = graph_models[0]
        log(f"\nFetching GraphModel definition: {gm['displayName']}")
        gm_def = api.get_definition("GraphModels", gm["id"])
        if gm_def:
            gm_parts = gm_def.get("definition", {}).get("parts", [])
            log(f"  GraphModel has {len(gm_parts)} parts")
            for p in gm_parts:
                path = p.get("path", "")
                log(f"    - {path}")
                if path in ("graphType.json", "dataSources.json", "graphDefinition.json"):
                    try:
                        data = b64dec(p["payload"])
                        if path == "graphType.json":
                            log(f"      nodeTypes: {len(data.get('nodeTypes', []))}, edgeTypes: {len(data.get('edgeTypes', []))}")
                        elif path == "dataSources.json":
                            log(f"      dataSources: {len(data.get('dataSources', []))}")
                        elif path == "graphDefinition.json":
                            log(f"      nodeTables: {len(data.get('nodeTables', []))}, edgeTables: {len(data.get('edgeTables', []))}")
                    except:
                        pass
        else:
            log("  Could not get GraphModel definition (may be empty)", "WARN")

    print(f"\n{'='*70}")
    print("READY FOR PHASE 3")
    print("  Run: python research/refresh_workaround.py --phase 3")
    print(f"{'='*70}")


# ============================================================================
# Helper: Wait for any running graph jobs to complete
# ============================================================================
def wait_for_graph_jobs(api: FabricAPI, graph_model_id: str, timeout_sec: int = 300):
    """Check for running RefreshGraph jobs and wait until none are in progress."""
    log("Checking for running graph refresh jobs...")
    start = time.time()
    
    while time.time() - start < timeout_sec:
        resp = api.get(f"workspaces/{WORKSPACE_ID}/items/{graph_model_id}/jobs/instances?limit=5")
        if resp.status_code != 200:
            log(f"Could not list jobs: {resp.status_code}", "WARN")
            time.sleep(5)
            continue
        
        jobs = resp.json().get("value", [])
        running_jobs = [j for j in jobs if j.get("status") in ("NotStarted", "InProgress", "Running")]
        
        if not running_jobs:
            log("No running graph jobs — safe to proceed", "OK")
            return True
        
        for j in running_jobs:
            log(f"  Running job: {j.get('id', '?')[:8]}... status={j.get('status')} "
                f"type={j.get('jobType', '?')}")
        
        elapsed = int(time.time() - start)
        log(f"Waiting for running jobs to complete... ({elapsed}s)")
        time.sleep(10)
    
    log(f"Timeout waiting for jobs after {timeout_sec}s", "WARN")
    return False


# ============================================================================
# PHASE 3: Rename workaround + RefreshGraph
# ============================================================================
def phase_3_rename_workaround(api: FabricAPI):
    print(f"\n{'='*70}")
    print(f"PHASE 3: RENAME WORKAROUND → TRIGGER GRAPH REFRESH")
    print(f"{'='*70}\n")

    # Find ontology
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items")
    items = resp.json().get("value", [])

    ontologies = [i for i in items if i["type"] == "Ontology"]
    graph_models = [i for i in items if i["type"] == "GraphModel"]

    if not ontologies:
        log("No ontologies found", "FAIL")
        return

    ont = ontologies[0]
    ontology_id = ont["id"]
    log(f"Using ontology: {ont['displayName']} ({ontology_id})")

    gm = graph_models[0] if graph_models else None
    if gm:
        graph_model_id = gm["id"]
        log(f"Using GraphModel: {gm['displayName']} ({graph_model_id})")
    else:
        log("No GraphModel found — cannot test RefreshGraph", "FAIL")
        return

    # Step 1: Get current definition
    log("\n--- Step 1: Get current ontology definition ---")
    defn = api.get_definition("ontologies", ontology_id)
    if not defn:
        log("Could not get ontology definition", "FAIL")
        return

    parts = defn.get("definition", {}).get("parts", [])
    log(f"Current definition has {len(parts)} parts")

    # Find a property to rename
    target_entity = None
    target_prop = None
    target_entity_path = None

    for p in parts:
        path = p.get("path", "")
        if "/definition.json" in path and "EntityTypes/" in path:
            try:
                payload = b64dec(p["payload"])
                props = payload.get("properties", [])
                # Pick a non-key property to rename (not the entityIdParts one)
                key_ids = set(payload.get("entityIdParts", []))
                display_id = payload.get("displayNamePropertyId")
                for prop in props:
                    pid = prop.get("id", "")
                    if pid not in key_ids and pid != display_id:
                        target_entity = payload
                        target_prop = prop
                        target_entity_path = path
                        break
                if target_prop:
                    break
            except:
                continue

    if not target_prop:
        # Fallback: just pick ANY property from the first entity that has >1 props
        for p in parts:
            path = p.get("path", "")
            if "/definition.json" in path and "EntityTypes/" in path:
                try:
                    payload = b64dec(p["payload"])
                    props = payload.get("properties", [])
                    if len(props) >= 2:
                        target_entity = payload
                        target_prop = props[-1]  # last property
                        target_entity_path = path
                        break
                except:
                    continue

    if not target_prop:
        log("No suitable property found to rename!", "FAIL")
        log("Need at least one entity type with 2+ properties", "FAIL")
        return

    original_name = target_prop["name"]
    # Rename: append "_v2" then rename back
    renamed_name = f"{original_name}_v2"

    log(f"\nTarget entity: {target_entity.get('name', '?')}")
    log(f"Target property: {original_name} (id={target_prop.get('id', '?')})")
    log(f"Will rename: {original_name} → {renamed_name}")

    # Step 2: Modify the property name in the definition
    log("\n--- Step 2: Rename property via updateDefinition ---")

    # Build modified parts list — change only the target entity
    modified_parts = []
    for p in parts:
        if p.get("path") == target_entity_path:
            payload = b64dec(p["payload"])
            for prop in payload.get("properties", []):
                if prop.get("id") == target_prop["id"]:
                    prop["name"] = renamed_name
                    log(f"  Modified property name in payload: {original_name} → {renamed_name}", "OK")
                    break
            modified_parts.append({
                "path": p["path"],
                "payload": b64enc(payload),
                "payloadType": "InlineBase64"
            })
        else:
            modified_parts.append({
                "path": p["path"],
                "payload": p["payload"],
                "payloadType": "InlineBase64"
            })

    # Upload modified definition
    resp = api.post(
        f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": modified_parts}}
    )

    result = api.wait_lro(resp, "updateDefinition (rename)")
    if not result or result.get("status") in ("Failed", "Cancelled"):
        log("updateDefinition failed!", "FAIL")
        return

    log("Property renamed successfully!", "OK")

    # Step 3: Wait a moment, then check if RefreshGraph triggers automatically
    log("\n--- Step 3: Check if graph refresh was auto-triggered ---")
    time.sleep(10)  # Give Fabric a moment to react

    # Check GraphModel job instances
    resp = api.get(f"workspaces/{WORKSPACE_ID}/items/{graph_model_id}/jobs/instances?limit=5")
    if resp.status_code == 200:
        jobs = resp.json().get("value", [])
        log(f"Recent GraphModel jobs: {len(jobs)}")
        for j in jobs:
            log(f"  - {j.get('jobType', '?')}: {j.get('status', '?')} "
                f"(created={j.get('startTimeUtc', j.get('createdTimeUtc', '?'))})")
            if j.get("failureReason"):
                log(f"    failureReason: {j['failureReason']}")
    else:
        log(f"Could not list jobs: {resp.status_code}", "WARN")

    # Step 4: Manually trigger RefreshGraph (with concurrency check)
    log("\n--- Step 4: Wait for any running jobs, then trigger RefreshGraph ---")
    
    # CRITICAL: Wait for any existing graph jobs to complete first
    # (Fabric rejects concurrent RefreshGraph with ConcurrentOperation error)
    if not wait_for_graph_jobs(api, graph_model_id, timeout_sec=300):
        log("Could not confirm no running jobs — proceeding anyway", "WARN")
    
    resp = api.post(
        f"workspaces/{WORKSPACE_ID}/items/{graph_model_id}/jobs/instances?jobType=RefreshGraph"
    )
    log(f"RefreshGraph response: {resp.status_code}")

    if resp.status_code == 202:
        result = api.wait_lro(resp, "RefreshGraph")
        if result:
            status = result.get("status", "Unknown")
            log(f"RefreshGraph final status: {status}", "OK" if status == "Succeeded" else "FAIL")
            if result.get("failureReason"):
                log(f"  failureReason: {result['failureReason']}")

            if status == "Succeeded":
                print(f"\n{'='*70}")
                print("🎉 REFRESH GRAPH SUCCEEDED!")
                print("Check Fabric portal → Graph to verify nodes/edges are visible")
                print(f"{'='*70}")

                # Step 5: Rename back to original
                log("\n--- Step 5: Rename property back to original ---")
                restore_parts = []
                for p in parts:
                    restore_parts.append({
                        "path": p["path"],
                        "payload": p["payload"],
                        "payloadType": "InlineBase64"
                    })
                resp = api.post(
                    f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}/updateDefinition",
                    {"definition": {"parts": restore_parts}}
                )
                r2 = api.wait_lro(resp, "updateDefinition (restore)")
                if r2 and r2.get("status") in ("Succeeded", "Completed"):
                    log(f"Property restored: {renamed_name} → {original_name}", "OK")
                else:
                    log(f"Restore may have failed — property is still named '{renamed_name}'", "WARN")

                return
    elif resp.status_code == 200:
        log("RefreshGraph returned 200 (synchronous success?)", "OK")
    else:
        log(f"RefreshGraph response: {resp.text[:300]}", "FAIL")

    # If RefreshGraph still fails, try renaming back and report
    log("\n--- RefreshGraph did not succeed — renaming property back ---")
    restore_parts = []
    for p in parts:
        restore_parts.append({
            "path": p["path"],
            "payload": p["payload"],
            "payloadType": "InlineBase64"
        })
    resp = api.post(
        f"workspaces/{WORKSPACE_ID}/ontologies/{ontology_id}/updateDefinition",
        {"definition": {"parts": restore_parts}}
    )
    api.wait_lro(resp, "updateDefinition (restore)")

    print(f"\n{'='*70}")
    print("RESULT: API-based rename did not trigger a working RefreshGraph")
    print("")
    print("MANUAL UI STEPS TO TRY:")
    print(f"  1. Open Fabric portal → workspace ws-rdf_translation-dev-01")
    print(f"  2. Open ontology: {ont['displayName']}")
    print(f"  3. Find entity type: {target_entity.get('name', '?')}")
    print(f"  4. Rename property '{original_name}' to '{renamed_name}' (or any name)")
    print(f"  5. Save the ontology")
    print(f"  6. Check if the Graph refreshes automatically")
    print(f"  7. If not, open the connected Graph and manually trigger refresh")
    print(f"  8. Rename the property back to '{original_name}' when done")
    print(f"{'='*70}")


# ============================================================================
# MAIN
# ============================================================================
def main():
    phase = 1
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg == "--phase":
                continue
            try:
                phase = int(arg.replace("--phase", "").strip())
            except:
                if "1" in arg: phase = 1
                elif "2" in arg: phase = 2
                elif "3" in arg: phase = 3

    api = FabricAPI()

    if phase == 1:
        phase_1_cleanup(api)
    elif phase == 2:
        phase_2_inspect(api)
    elif phase == 3:
        phase_3_rename_workaround(api)
    else:
        print(f"Unknown phase: {phase}")
        print("Usage: python research/refresh_workaround.py --phase 1|2|3")


if __name__ == "__main__":
    main()
