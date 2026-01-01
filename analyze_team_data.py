#!/usr/bin/env python3
"""
Analyze team data to verify:
1. Is Team A data inflated with TFOS?
2. Calculate correct efficiency based on person-hours
"""

from supabase import create_client
from collections import defaultdict
from datetime import datetime

# Supabase configuration
SUPABASE_URL = "https://fsubmqjevlfpcirgsbhi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWJtcWpldmxmcGNpcmdzYmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNTgyNzgsImV4cCI6MjA2NDkzNDI3OH0.Hfo1kCUCVMvr2ffhLJ3rp7qLMchWYdmBkzOYcorQVQE"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Team mapping
INITIAL_TO_TEAM = {
    # Team A
    "AS": "Team A", "JT": "Team A", "CB": "Team A", "JD": "Team A",
    "KM": "Team A", "CP": "Team A", "KA": "Team A",
    # Team B
    "LN": "Team B", "NA": "Team B", "PS": "Team B", "AOO": "Team B",
    "JN": "Team B", "DK": "Team B", "DH": "Team B", "JL": "Team B",
    # Team C
    "SC": "Team C", "MA": "Team C", "CC": "Team C", "OM": "Team C",
    "AL": "Team C", "VN": "Team C", "RN": "Team C", "LVN": "Team C",
    # Team D (Night Shift)
    "SA": "Team D", "MR": "Team D", "AR": "Team D", "DB": "Team D",
    "GT": "Team D", "UQ": "Team D", "BP": "Team D", "RB": "Team D",
    # TFOS - separate
    "TFOS": "TFOS",
}

def analyze():
    print("=" * 70)
    print("ANALYZING TEAM DATA")
    print("=" * 70)

    # Fetch all completions
    print("\nFetching task completions...")
    all_completions = []
    offset = 0
    batch_size = 1000

    while True:
        result = supabase.table('task_completions').select(
            'id, status, completed_by, completed_at, total_minutes, team_id, teams(name)'
        ).range(offset, offset + batch_size - 1).execute()

        if not result.data:
            break
        all_completions.extend(result.data)
        offset += batch_size
        if offset % 10000 == 0:
            print(f"  Fetched {len(all_completions)} records...")

    print(f"\nTotal completions: {len(all_completions)}")

    # Analyze by database team_id
    print("\n" + "=" * 70)
    print("ANALYSIS BY DATABASE TEAM_ID")
    print("=" * 70)

    db_team_stats = defaultdict(lambda: {'completed': 0, 'total': 0, 'minutes': 0})
    for c in all_completions:
        team_name = c.get('teams', {}).get('name') if c.get('teams') else 'No Team'
        if team_name == 'Night Shift':
            team_name = 'Team D'
        db_team_stats[team_name]['total'] += 1
        if c['status'] == 'completed':
            db_team_stats[team_name]['completed'] += 1
            db_team_stats[team_name]['minutes'] += c.get('total_minutes') or 0

    print(f"\n{'Team':<15} {'Completed':<12} {'Total':<10} {'Hours':<10}")
    print("-" * 50)
    for team in sorted(db_team_stats.keys()):
        stats = db_team_stats[team]
        hours = round(stats['minutes'] / 60, 1)
        print(f"{team:<15} {stats['completed']:<12} {stats['total']:<10} {hours:<10}")

    # Analyze by completed_by initials
    print("\n" + "=" * 70)
    print("ANALYSIS BY COMPLETED_BY INITIALS")
    print("=" * 70)

    initial_stats = defaultdict(lambda: {'count': 0, 'minutes': 0, 'dates': set()})
    unknown_initials = set()

    for c in all_completions:
        if c['status'] != 'completed':
            continue

        completed_by = c.get('completed_by')
        if not completed_by:
            continue

        # Parse completed_by (could be array or comma-separated string)
        if isinstance(completed_by, list):
            initials = completed_by
        else:
            initials = [s.strip() for s in str(completed_by).split(',') if s.strip()]

        for initial in initials:
            initial_upper = initial.upper().strip()
            initial_stats[initial_upper]['count'] += 1
            initial_stats[initial_upper]['minutes'] += (c.get('total_minutes') or 0) / len(initials)

            # Track dates
            if c.get('completed_at'):
                date_str = c['completed_at'].split('T')[0]
                initial_stats[initial_upper]['dates'].add(date_str)

            if initial_upper not in INITIAL_TO_TEAM:
                unknown_initials.add(initial_upper)

    # Group by team from initials
    team_from_initials = defaultdict(lambda: {'count': 0, 'minutes': 0, 'person_days': 0, 'members': set()})

    for initial, stats in initial_stats.items():
        team = INITIAL_TO_TEAM.get(initial, 'Unknown')
        team_from_initials[team]['count'] += stats['count']
        team_from_initials[team]['minutes'] += stats['minutes']
        team_from_initials[team]['members'].add(initial)
        team_from_initials[team]['person_days'] += len(stats['dates'])

    print(f"\n{'Team':<15} {'Tasks':<10} {'Hours':<10} {'Person-Days':<12} {'Members'}")
    print("-" * 80)
    for team in sorted(team_from_initials.keys()):
        stats = team_from_initials[team]
        hours = round(stats['minutes'] / 60, 1)
        members = ', '.join(sorted(stats['members']))
        print(f"{team:<15} {stats['count']:<10} {hours:<10} {stats['person_days']:<12} {members}")

    # Check for TFOS in database team assignments
    print("\n" + "=" * 70)
    print("CHECKING TFOS ATTRIBUTION")
    print("=" * 70)

    tfos_in_team_a = 0
    tfos_standalone = 0

    for c in all_completions:
        completed_by = c.get('completed_by')
        if not completed_by:
            continue

        if isinstance(completed_by, list):
            initials = completed_by
        else:
            initials = [s.strip().upper() for s in str(completed_by).split(',') if s.strip()]

        has_tfos = 'TFOS' in [i.upper() for i in initials]

        if has_tfos:
            team_name = c.get('teams', {}).get('name') if c.get('teams') else None
            if team_name == 'Team A':
                tfos_in_team_a += 1
            elif not team_name:
                tfos_standalone += 1

    print(f"\nTFOS tasks with Team A in database: {tfos_in_team_a}")
    print(f"TFOS tasks with no team: {tfos_standalone}")

    # Individual breakdown
    print("\n" + "=" * 70)
    print("INDIVIDUAL PERFORMANCE (Top 20)")
    print("=" * 70)

    sorted_initials = sorted(initial_stats.items(), key=lambda x: x[1]['count'], reverse=True)

    print(f"\n{'Initial':<10} {'Team':<12} {'Tasks':<10} {'Hours':<10} {'Days':<8} {'Efficiency'}")
    print("-" * 70)

    for initial, stats in sorted_initials[:20]:
        team = INITIAL_TO_TEAM.get(initial, 'Unknown')
        hours = round(stats['minutes'] / 60, 1)
        days = len(stats['dates'])
        # Efficiency = task hours / (8 hours × days worked)
        if days > 0:
            efficiency = round((stats['minutes'] / 60) / (8 * days) * 100, 1)
        else:
            efficiency = 0
        print(f"{initial:<10} {team:<12} {stats['count']:<10} {hours:<10} {days:<8} {efficiency}%")

    if unknown_initials:
        print(f"\n\nUnknown initials found: {sorted(unknown_initials)}")

    # Calculate correct team efficiency
    print("\n" + "=" * 70)
    print("CORRECT EFFICIENCY CALCULATION")
    print("=" * 70)
    print("Formula: Efficiency = (task hours) / (8 hours × person-days worked)")

    print(f"\n{'Team':<15} {'Task Hours':<12} {'Person-Days':<14} {'Max Hours':<12} {'Efficiency'}")
    print("-" * 70)

    for team in sorted(team_from_initials.keys()):
        if team == 'Unknown':
            continue
        stats = team_from_initials[team]
        task_hours = stats['minutes'] / 60
        person_days = stats['person_days']
        max_hours = person_days * 8
        if max_hours > 0:
            efficiency = round(task_hours / max_hours * 100, 1)
        else:
            efficiency = 0
        print(f"{team:<15} {round(task_hours, 1):<12} {person_days:<14} {round(max_hours, 1):<12} {efficiency}%")


if __name__ == "__main__":
    analyze()
