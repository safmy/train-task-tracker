#!/usr/bin/env python3
"""
Find and fix bad dates in task_completions table
Dates like "Oct 3, 3034" are clearly data entry errors
"""

from supabase import create_client
from datetime import datetime, timedelta

# Supabase configuration
SUPABASE_URL = "https://fsubmqjevlfpcirgsbhi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWJtcWpldmxmcGNpcmdzYmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNTgyNzgsImV4cCI6MjA2NDkzNDI3OH0.Hfo1kCUCVMvr2ffhLJ3rp7qLMchWYdmBkzOYcorQVQE"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def find_bad_dates():
    """Find all task_completions with dates in the future (beyond 2026)"""
    print("=" * 60)
    print("FINDING BAD DATES IN TASK_COMPLETIONS")
    print("=" * 60)

    # Fetch all completions with completed_at dates
    all_completions = []
    offset = 0
    batch_size = 1000

    while True:
        result = supabase.table('task_completions').select('id, task_name, completed_at, car_id').range(offset, offset + batch_size - 1).execute()
        if not result.data:
            break
        all_completions.extend(result.data)
        offset += batch_size
        if offset % 10000 == 0:
            print(f"  Fetched {len(all_completions)} records...")

    print(f"Total records: {len(all_completions)}")

    # Find bad dates
    bad_dates = []
    cutoff_date = datetime(2026, 12, 31)  # Any date after 2026 is suspicious
    min_valid_date = datetime(2020, 1, 1)  # Any date before 2020 is also suspicious

    for comp in all_completions:
        if comp.get('completed_at'):
            try:
                date_str = comp['completed_at']
                # Parse the date
                if 'T' in date_str:
                    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')

                # Check if date is invalid
                if date_obj > cutoff_date or date_obj < min_valid_date:
                    bad_dates.append({
                        'id': comp['id'],
                        'task_name': comp['task_name'],
                        'completed_at': comp['completed_at'],
                        'date_obj': date_obj
                    })
            except Exception as e:
                print(f"  Parse error for {comp['id']}: {comp['completed_at']} - {e}")
                bad_dates.append({
                    'id': comp['id'],
                    'task_name': comp['task_name'],
                    'completed_at': comp['completed_at'],
                    'date_obj': None
                })

    print(f"\nFound {len(bad_dates)} records with bad dates:")
    for bd in bad_dates[:20]:  # Show first 20
        print(f"  ID: {bd['id'][:8]}... | Task: {bd['task_name'][:30]} | Date: {bd['completed_at']}")

    if len(bad_dates) > 20:
        print(f"  ... and {len(bad_dates) - 20} more")

    return bad_dates

def fix_bad_dates(bad_dates, dry_run=True):
    """Fix bad dates by setting them to NULL or a reasonable default"""
    print("\n" + "=" * 60)
    print(f"FIXING BAD DATES ({'DRY RUN' if dry_run else 'LIVE'})")
    print("=" * 60)

    if not bad_dates:
        print("No bad dates to fix!")
        return

    fixed = 0
    for bd in bad_dates:
        if dry_run:
            print(f"  Would set completed_at to NULL for {bd['id'][:8]}... ({bd['task_name'][:30]})")
        else:
            try:
                # Set bad dates to NULL - the task might be completed but we don't know when
                supabase.table('task_completions').update({
                    'completed_at': None
                }).eq('id', bd['id']).execute()
                fixed += 1
                if fixed % 100 == 0:
                    print(f"  Fixed {fixed} records...")
            except Exception as e:
                print(f"  Error fixing {bd['id']}: {e}")

    print(f"\n{'Would fix' if dry_run else 'Fixed'} {len(bad_dates)} records")

if __name__ == "__main__":
    bad_dates = find_bad_dates()

    if bad_dates:
        print("\n" + "=" * 60)
        response = input("Do you want to fix these dates? (y/N): ").strip().lower()
        if response == 'y':
            fix_bad_dates(bad_dates, dry_run=False)
            print("\nDone! Dates have been set to NULL.")
            print("The tasks will still show as 'completed' but without a specific date.")
        else:
            print("No changes made.")
    else:
        print("\nNo bad dates found!")
