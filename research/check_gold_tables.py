"""
Check if the gold_* tables exist and have data in the lakehouse.

Run: python research/check_gold_tables.py
"""

import requests
import subprocess
import json

WORKSPACE_ID = "52fc996f-ca95-4e33-9f60-7f5f47cdf8a5"
LAKEHOUSE_ID = "32e17923-0b8b-4106-953a-6d63081fa361"

def get_fabric_token():
    result = subprocess.run(
        "az account get-access-token --resource https://storage.azure.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    return result.stdout.strip()


def main():
    token = get_fabric_token()
    
    # OneLake DFS API
    base_url = f"https://onelake.dfs.fabric.microsoft.com/{WORKSPACE_ID}/{LAKEHOUSE_ID}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("=" * 70)
    print("CHECK GOLD TABLES IN LAKEHOUSE")
    print("=" * 70)
    
    # List tables folder
    print("\n--- List Tables/dbo folder ---")
    tables_url = f"{base_url}/Tables/dbo?resource=filesystem&recursive=false"
    
    try:
        resp = requests.get(tables_url, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            paths = data.get("paths", [])
            
            # Filter for gold_ tables
            gold_tables = [p for p in paths if p.get("name", "").startswith("Tables/dbo/gold_")]
            
            print(f"Found {len(gold_tables)} gold_* tables:")
            for p in sorted(gold_tables, key=lambda x: x.get("name", "")):
                name = p.get("name", "").replace("Tables/dbo/", "")
                print(f"  - {name}")
            
            # Also check for gold_nodes and gold_edges
            all_tables = [p.get("name", "").replace("Tables/dbo/", "") for p in paths]
            
            if "gold_nodes" in all_tables:
                print("\n✅ gold_nodes table exists")
            else:
                print("\n⚠️ gold_nodes table NOT found")
                
            if "gold_edges" in all_tables:
                print("✅ gold_edges table exists")
            else:
                print("⚠️ gold_edges table NOT found")
                
        else:
            print(f"Failed: {resp.status_code}")
            print(resp.text[:500])
    except Exception as e:
        print(f"Error: {e}")
    
    # Alternative: Use Fabric API to list lakehouse tables
    print("\n--- Using Fabric SQL Endpoint ---")
    
    # Get Fabric token
    fabric_token_result = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True
    )
    fabric_token = fabric_token_result.stdout.strip()
    fabric_headers = {
        "Authorization": f"Bearer {fabric_token}",
        "Content-Type": "application/json"
    }
    
    # List lakehouse tables via items API
    resp = requests.get(
        f"https://api.fabric.microsoft.com/v1/workspaces/{WORKSPACE_ID}/lakehouses/{LAKEHOUSE_ID}/tables",
        headers=fabric_headers,
        timeout=30
    )
    
    if resp.status_code == 200:
        tables = resp.json().get("value", [])
        gold_tables = [t for t in tables if t.get("name", "").startswith("gold_")]
        print(f"Found {len(gold_tables)} gold_* tables via API:")
        for t in sorted(gold_tables, key=lambda x: x.get("name", "")):
            loc = t.get("location", "")
            rows = t.get("rowCount", "?")
            print(f"  - {t['name']}: {rows} rows")
    else:
        print(f"Table list failed: {resp.status_code}")
        print(resp.text[:500])


if __name__ == "__main__":
    main()
