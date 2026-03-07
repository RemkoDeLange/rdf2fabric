"""
Investigate predicate mismatch between schema and instance data.

Question 1: What ObjectProperties ARE defined in the NEN 2660-2 OWL schema?
Question 2: Do the example files use predicates from a DIFFERENT namespace?
"""

import os
from azure.identity import DefaultAzureCredential
from azure.storage.filedatalake import DataLakeServiceClient
import pandas as pd
import pyarrow.parquet as pq
from io import BytesIO

# Configuration
WORKSPACE_NAME = "ws-rdf_translation-dev-01"
LAKEHOUSE_NAME = "lh_rdf_translation_dev_01.Lakehouse"
ONELAKE_URL = "https://onelake.dfs.fabric.microsoft.com"

def get_datalake_client():
    """Get authenticated DataLake client."""
    credential = DefaultAzureCredential()
    return DataLakeServiceClient(ONELAKE_URL, credential=credential)

def list_tables(client):
    """List all tables in the lakehouse."""
    fs_client = client.get_file_system_client(WORKSPACE_NAME)
    # Tables are under dbo schema in Fabric lakehouses
    base_path = f"{LAKEHOUSE_NAME}/Tables/dbo"
    
    try:
        print(f"\nExploring: {base_path}")
        paths = list(fs_client.get_paths(path=base_path, recursive=False))
        
        # Get directory names (table names)
        tables = [p.name.split('/')[-1] for p in paths if p.is_directory]
        return tables
    except Exception as e:
        print(f"Error listing tables: {e}")
        return []

def read_delta_table(client, table_name: str) -> pd.DataFrame:
    """Read Delta table from OneLake as DataFrame."""
    fs_client = client.get_file_system_client(WORKSPACE_NAME)
    # Tables are under dbo schema
    base_path = f"{LAKEHOUSE_NAME}/Tables/dbo/{table_name}"
    
    try:
        paths = list(fs_client.get_paths(path=base_path, recursive=True))
    except Exception as e:
        print(f"  Error: {e}")
        return pd.DataFrame()
    
    # Get parquet files that are NOT in _delta_log (those are metadata)
    parquet_files = [
        p.name for p in paths 
        if p.name.endswith('.parquet') and '/_delta_log/' not in p.name
    ]
    
    if not parquet_files:
        print(f"  No data parquet files found (only metadata)")
        return pd.DataFrame()
    
    print(f"  Found {len(parquet_files)} data file(s)")
    
    # Read all parquet files and concatenate
    dfs = []
    for pf in parquet_files[:5]:  # Limit to first 5 files
        try:
            file_client = fs_client.get_file_client(pf)
            download = file_client.download_file()
            data = download.readall()
            df = pq.read_table(BytesIO(data)).to_pandas()
            dfs.append(df)
        except Exception as e:
            print(f"  Error reading {pf}: {e}")
    
    if not dfs:
        return pd.DataFrame()
    
    result = pd.concat(dfs, ignore_index=True)
    print(f"  Loaded {len(result)} rows")
    return result

def main():
    client = get_datalake_client()
    
    # First, list available tables
    print("=" * 80)
    print("AVAILABLE TABLES IN LAKEHOUSE")
    print("=" * 80)
    tables = list_tables(client)
    if tables:
        for t in tables:
            print(f"  - {t}")
    else:
        print("  No tables found (or access error)")
        return
    
    print("\n" + "=" * 80)
    print("QUESTION 1: What ObjectProperties are defined in the schema?")
    print("=" * 80)
    
    # Read silver_properties table
    df_props = None
    if "silver_properties" in tables:
        print("\nReading silver_properties...")
        df_props = read_delta_table(client, "silver_properties")
        
        if len(df_props) > 0:
            print(f"\nColumns: {list(df_props.columns)}")
            
            # Filter to edge type (owl:ObjectProperty)
            if 'mapping_type' in df_props.columns:
                df_edges = df_props[df_props['mapping_type'] == 'edge']
                
                print(f"\nDefined ObjectProperties (edge mappings): {len(df_edges)}")
                print("-" * 60)
                
                if len(df_edges) > 0:
                    for _, row in df_edges.iterrows():
                        name = row.get('name', 'N/A')
                        uri = row.get('property_uri', 'N/A')
                        src = row.get('source_type', '?')
                        tgt = row.get('target_type', '?')
                        print(f"  - {name:30} {src} -> {tgt}")
                        print(f"    URI: {uri}")
                else:
                    print("  No edge-type properties defined!")
                    
                print(f"\nAll mapping_type values:")
                print(df_props['mapping_type'].value_counts())
            else:
                print("  No 'mapping_type' column found")
    else:
        print("  silver_properties table not found")
    
    print("\n" + "=" * 80)
    print("QUESTION 2: What predicates do instance edges actually use?")
    print("=" * 80)
    
    # Read silver_edges table (has full predicate URIs)
    df_silver_edges = None
    if "silver_edges" in tables:
        print("\nReading silver_edges...")
        df_silver_edges = read_delta_table(client, "silver_edges")
        
        if len(df_silver_edges) > 0:
            print(f"\nColumns: {list(df_silver_edges.columns)}")
            
            # Get unique types with counts
            if 'type' in df_silver_edges.columns:
                print("\nEdge types (local names) in instance data:")
                type_counts = df_silver_edges['type'].value_counts()
                for t, count in type_counts.head(20).items():
                    print(f"  - {t:35} count: {count}")
            
            # Check predicate URIs
            if 'predicate_uri' in df_silver_edges.columns:
                print("\nUnique predicate URIs:")
                uri_counts = df_silver_edges['predicate_uri'].value_counts()
                for uri, count in uri_counts.head(20).items():
                    print(f"  - {uri}")
    else:
        print("  silver_edges table not found")
    
    print("\n" + "=" * 80)
    print("ANALYSIS: Namespace comparison")
    print("=" * 80)
    
    if df_silver_edges is not None and 'predicate_uri' in df_silver_edges.columns:
        instance_predicates = df_silver_edges['predicate_uri'].unique()
        print(f"\nUnique predicate URIs in instance data: {len(instance_predicates)}")
        
        # Group by namespace
        namespaces = {}
        for uri in instance_predicates:
            if '#' in uri:
                ns = uri.rsplit('#', 1)[0] + '#'
            elif '/' in uri:
                ns = uri.rsplit('/', 1)[0] + '/'
            else:
                ns = uri
            namespaces[ns] = namespaces.get(ns, 0) + 1
        
        print("\nNamespaces used in instance predicates:")
        for ns, count in sorted(namespaces.items(), key=lambda x: -x[1]):
            print(f"  - {ns}: {count} predicates")
    
    # Compare schema vs instance
    if df_props is not None and df_silver_edges is not None:
        print("\n" + "-" * 60)
        print("COMPARISON: Schema-defined vs Instance predicates")
        print("-" * 60)
        
        if 'mapping_type' in df_props.columns and 'predicate_uri' in df_silver_edges.columns:
            schema_uris = set(df_props[df_props['mapping_type'] == 'edge']['property_uri'].dropna())
            instance_uris = set(df_silver_edges['predicate_uri'].dropna())
            
            matched = schema_uris & instance_uris
            schema_only = schema_uris - instance_uris
            instance_only = instance_uris - schema_uris
            
            print(f"\n✅ Matched (in both): {len(matched)}")
            for uri in sorted(matched)[:10]:
                print(f"   {uri}")
                
            print(f"\n⚠️ Schema-only (defined but not in instances): {len(schema_only)}")
            for uri in sorted(schema_only)[:10]:
                print(f"   {uri}")
            if len(schema_only) > 10:
                print(f"   ... and {len(schema_only) - 10} more")
                
            print(f"\n❌ Instance-only (no schema definition): {len(instance_only)}")
            for uri in sorted(instance_only)[:15]:
                print(f"   {uri}")
            if len(instance_only) > 15:
                print(f"   ... and {len(instance_only) - 15} more")

if __name__ == "__main__":
    main()
