#!/usr/bin/env python3
"""
Fix TFOS team assignment:
1. Create TFOS team if not exists
2. Move all tasks with TFOS in completed_by to TFOS team
"""

from supabase import create_client

# Supabase configuration
SUPABASE_URL = "https://fsubmqjevlfpcirgsbhi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWJtcWpldmxmcGNpcmdzYmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNTgyNzgsImV4cCI6MjA2NDkzNDI3OH0.Hfo1kCUCVMvr2ffhLJ3rp7qLMchWYdmBkzOYcorQVQE"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fix_tfos():
    print("=" * 60)
    print("FIXING TFOS TEAM ASSIGNMENT")
    print("=" * 60)

    # Step 1: Check if TFOS team exists
    print("\n1. Checking for TFOS team...")
    teams_result = supabase.table('teams').select('*').execute()
    teams_by_name = {t['name']: t for t in teams_result.data}

    print(f"   Existing teams: {list(teams_by_name.keys())}")

    tfos_team_id = None
    if 'TFOS' in teams_by_name:
        tfos_team_id = teams_by_name['TFOS']['id']
        print(f"   TFOS team exists with ID: {tfos_team_id}")
    else:
        print("   Creating TFOS team...")
        new_team = supabase.table('teams').insert({
            'name': 'TFOS',
            'color': '#EF4444'  # Red
        }).execute()
        tfos_team_id = new_team.data[0]['id']
        print(f"   Created TFOS team with ID: {tfos_team_id}")

    # Step 2: Find all tasks with TFOS in completed_by
    print("\n2. Finding tasks with TFOS in completed_by...")
    all_completions = []
    offset = 0
    batch_size = 1000

    while True:
        result = supabase.table('task_completions').select(
            'id, completed_by, team_id'
        ).range(offset, offset + batch_size - 1).execute()

        if not result.data:
            break
        all_completions.extend(result.data)
        offset += batch_size

    print(f"   Total task completions: {len(all_completions)}")

    # Find tasks with TFOS
    tfos_tasks = []
    for c in all_completions:
        completed_by = c.get('completed_by')
        if not completed_by:
            continue

        if isinstance(completed_by, list):
            initials = [i.upper() for i in completed_by]
        else:
            initials = [s.strip().upper() for s in str(completed_by).split(',') if s.strip()]

        if 'TFOS' in initials:
            tfos_tasks.append(c)

    print(f"   Tasks with TFOS: {len(tfos_tasks)}")

    # Count how many are already correctly assigned
    already_correct = sum(1 for t in tfos_tasks if t.get('team_id') == tfos_team_id)
    needs_update = sum(1 for t in tfos_tasks if t.get('team_id') != tfos_team_id)

    print(f"   Already correctly assigned to TFOS: {already_correct}")
    print(f"   Need to update: {needs_update}")

    if needs_update == 0:
        print("\n   No updates needed!")
        return

    # Step 3: Update tasks to TFOS team
    print(f"\n3. Updating {needs_update} tasks to TFOS team...")

    response = input(f"\n   Do you want to update {needs_update} tasks? (y/N): ").strip().lower()
    if response != 'y':
        print("   Cancelled.")
        return

    updated = 0
    errors = 0
    batch = []

    for t in tfos_tasks:
        if t.get('team_id') != tfos_team_id:
            batch.append(t['id'])

            if len(batch) >= 100:
                try:
                    for task_id in batch:
                        supabase.table('task_completions').update({
                            'team_id': tfos_team_id
                        }).eq('id', task_id).execute()
                    updated += len(batch)
                    print(f"   Updated {updated} tasks...")
                except Exception as e:
                    errors += len(batch)
                    print(f"   Error: {e}")
                batch = []

    # Process remaining batch
    if batch:
        try:
            for task_id in batch:
                supabase.table('task_completions').update({
                    'team_id': tfos_team_id
                }).eq('id', task_id).execute()
            updated += len(batch)
        except Exception as e:
            errors += len(batch)
            print(f"   Error: {e}")

    print(f"\n   Updated: {updated}")
    print(f"   Errors: {errors}")

    # Verify
    print("\n4. Verifying...")
    verify = supabase.table('task_completions').select(
        'id', count='exact'
    ).eq('team_id', tfos_team_id).execute()
    print(f"   Tasks now assigned to TFOS team: {verify.count}")


if __name__ == "__main__":
    fix_tfos()
