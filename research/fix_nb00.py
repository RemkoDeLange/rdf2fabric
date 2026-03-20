"""
Fix NB00 cell 4 - broken print statements and misplaced return.
"""
import json

NB_PATH = r'c:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation\src\notebooks\00_pipeline_orchestrator.ipynb'

# Load notebook
with open(NB_PATH, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Get cell 4 source as a single string
cell_source = ''.join(nb['cells'][4]['source'])

# Fix the broken section
old_section = '''    write_progress(
        current_step=None,
        completed=completed,
        status="completed",
        step_times=step_times
    )

        return completed

    print(f"\\n{'='*60}")

    print("Pipeline Complete!")    print("="*60)

    print(f"Total duration: {int(total_duration)}s ({int(total_duration/60)}m)")    print(f"Steps completed: {len(completed)}/{len(PIPELINE_STEPS)}")'''

new_section = '''    write_progress(
        current_step=None,
        completed=completed,
        status="completed",
        step_times=step_times
    )
    
    print(f"\\n{'='*60}")
    print("Pipeline Complete!")
    print("="*60)
    print(f"Total duration: {int(total_duration)}s ({int(total_duration/60)}m)")
    print(f"Steps completed: {len(completed)}/{len(PIPELINE_STEPS)}")
    
    return completed'''

if old_section in cell_source:
    cell_source = cell_source.replace(old_section, new_section)
    print("✓ Fixed broken section")
else:
    print("⚠ Could not find exact broken section")
    # Try alternative fix
    cell_source = cell_source.replace(
        '        return completed\n\n    print', 
        '    print'
    )
    cell_source = cell_source.replace(
        'print("Pipeline Complete!")    print("="*60)',
        'print("Pipeline Complete!")\n    print("="*60)'
    )
    cell_source = cell_source.replace(
        '({int(total_duration/60)}m)")    print(f"Steps completed',
        '({int(total_duration/60)}m)")\n    print(f"Steps completed'
    )
    # Add return at the end
    if 'return completed' not in cell_source:
        cell_source = cell_source.rstrip() + '\n    \n    return completed'
    print("  Applied alternative fixes")

# Convert back to line-based format
lines = cell_source.split('\n')
nb['cells'][4]['source'] = [line + '\n' for line in lines[:-1]] + [lines[-1]]

# Save
with open(NB_PATH, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("✓ Saved NB00")
