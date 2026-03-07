#!/usr/bin/env python3
"""Update NB09 with longer timeout for RefreshGraph job waiting."""

import json

NEW_CELL_SOURCE = """# Step 4: Trigger RefreshGraph and poll until completion
# IMPORTANT: Fabric doesn't allow concurrent RefreshGraph jobs.
# A full graph refresh can take 30+ minutes for large ontologies.
# Must wait for any running job to complete before triggering a new one.
import time as _time

# Helper: Wait for any running graph jobs to complete
def wait_for_running_graph_jobs(gm_id, timeout_sec=1800, poll_interval_sec=30):
    '''
    Check for running RefreshGraph jobs and wait until none are in progress.
    Default: 30 minute timeout, check every 30 seconds.
    '''
    print('Checking for running graph refresh jobs...')
    print(f'  Will wait up to {timeout_sec // 60} minutes, checking every {poll_interval_sec}s')
    start = _time.time()
    
    while _time.time() - start < timeout_sec:
        elapsed_min = int((_time.time() - start) / 60)
        jobs_resp = api_request('GET', f'{FABRIC_API_VERSION}/workspaces/{workspace_id}/items/{gm_id}/jobs/instances?limit=5')
        if jobs_resp.status_code != 200:
            print(f'  [{elapsed_min}m] Could not list jobs: {jobs_resp.status_code}')
            _time.sleep(poll_interval_sec)
            continue
        
        jobs = jobs_resp.json().get('value', [])
        running = [j for j in jobs if j.get('status') in ('NotStarted', 'InProgress', 'Running')]
        
        if not running:
            print(f'  [{elapsed_min}m] No running graph jobs - safe to proceed.')
            return True
        
        # Show status of running jobs
        for j in running:
            job_id_short = j.get('id', '?')[:8]
            status = j.get('status', '?')
            pct = j.get('percentComplete', '?')
            print(f'  [{elapsed_min}m] Job {job_id_short}... status={status} progress={pct}%')
        
        _time.sleep(poll_interval_sec)
    
    total_min = int((_time.time() - start) / 60)
    print(f'  Timeout after {total_min} minutes - proceeding anyway (may get ConcurrentOperation error)')
    return False

# Wait for any concurrent jobs first (up to 30 minutes)
wait_for_running_graph_jobs(graph_model_id, timeout_sec=1800, poll_interval_sec=30)

refresh_endpoint = f"{FABRIC_API_VERSION}/workspaces/{workspace_id}/items/{graph_model_id}/jobs/instances?jobType=RefreshGraph"
print(f"Triggering RefreshGraph on GraphModel {graph_model_id}...")

resp = api_request("POST", refresh_endpoint, timeout=30)
print(f"  Response: {resp.status_code}")

if resp.status_code == 202:
    job_location = resp.headers.get("Location")
    retry_after = int(resp.headers.get("Retry-After", "30"))
    print(f"  Job accepted. Retry-After: {retry_after}s")
    print(f"  Job URL: {job_location}")

    # Poll for job completion - use longer timeout for full graph refresh
    # Full refresh can take 30+ minutes for large ontologies
    poll_interval = max(retry_after, 30)  # At least 30 seconds between polls
    max_polls = 120  # 120 * 30s = 60 minutes max wait
    
    print(f"  Polling every {poll_interval}s for up to {max_polls * poll_interval // 60} minutes...")
    
    for i in range(max_polls):
        _time.sleep(poll_interval)
        job_resp = requests.get(job_location, headers=get_headers(), timeout=60)
        elapsed_min = (i + 1) * poll_interval // 60
        
        if job_resp.status_code == 200:
            job_data = job_resp.json()
            status = job_data.get("status", "Unknown")
            pct = job_data.get("percentComplete", "?")
            print(f"  [{elapsed_min}m] Job status: {status} ({pct}%)")
            
            if status in ("Completed", "Succeeded"):
                print("✓ RefreshGraph succeeded — Graph is now populated!")
                break
            elif status in ("Failed", "Cancelled"):
                print(f"✗ RefreshGraph {status}:")
                print(json.dumps(job_data, indent=2))
                break
        else:
            print(f"  [{elapsed_min}m] Poll HTTP {job_resp.status_code}")
    else:
        print("⚠ Polling timed out after 60 minutes — check Fabric portal for job status.")
elif resp.status_code == 200:
    print("✓ RefreshGraph completed synchronously")
else:
    error_text = resp.text[:500] if resp.text else "no body"
    print(f"✗ RefreshGraph trigger failed ({resp.status_code}): {error_text}")
"""

def main():
    nb_path = r'c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\09_data_binding.ipynb'
    
    with open(nb_path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    # Find and update the RefreshGraph cell
    for i, cell in enumerate(nb['cells']):
        if cell.get('cell_type') == 'code':
            src = ''.join(cell.get('source', []))
            if '# Step 4: Trigger RefreshGraph' in src:
                # Update the cell with longer timeout
                lines = NEW_CELL_SOURCE.split('\n')
                cell['source'] = [line + '\n' for line in lines[:-1]] + [lines[-1]]
                print(f'Updated cell {i}')
                break
    
    with open(nb_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    
    print('Done! NB09 now has:')
    print('  - 30 minute timeout waiting for running jobs')
    print('  - 30 second polling interval')
    print('  - 60 minute max wait for new RefreshGraph job')

if __name__ == "__main__":
    main()
