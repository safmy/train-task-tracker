#!/usr/bin/env python3
"""
Populate Supabase with all 60 Jubilee Line trains (T01-T60)
Creates train_units entries with proper phase and unit pairings
"""

import json
from supabase import create_client
from datetime import datetime

# Supabase configuration
SUPABASE_URL = "https://fsubmqjevlfpcirgsbhi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWJtcWpldmxmcGNpcmdzYmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNTgyNzgsImV4cCI6MjA2NDkzNDI3OH0.Hfo1kCUCVMvr2ffhLJ3rp7qLMchWYdmBkzOYcorQVQE"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Complete train mapping
TRAINS = {
    # Phase 1: T01-T06
    "T01": {"units": ["96067", "96122"], "phase": "Phase 1"},
    "T02": {"units": ["96051", "96062"], "phase": "Phase 1"},
    "T03": {"units": ["96099", "96104"], "phase": "Phase 1"},
    "T04": {"units": ["96075", "96118"], "phase": "Phase 1"},
    "T05": {"units": ["96113", "96018"], "phase": "Phase 1"},
    "T06": {"units": ["96017", "96078"], "phase": "Phase 1"},

    # Phase 2: T07-T31
    "T07": {"units": ["96011", "96040"], "phase": "Phase 2"},
    "T08": {"units": ["96097", "96086"], "phase": "Phase 2"},
    "T09": {"units": ["96043", "96022"], "phase": "Phase 2"},
    "T10": {"units": ["96109", "96110"], "phase": "Phase 2"},
    "T11": {"units": ["96019", "96066"], "phase": "Phase 2"},
    "T12": {"units": ["96101", "96058"], "phase": "Phase 2"},
    "T13": {"units": ["96039", "96034"], "phase": "Phase 2"},
    "T14": {"units": ["96055", "96044"], "phase": "Phase 2"},
    "T15": {"units": ["96007", "96096"], "phase": "Phase 2"},
    "T16": {"units": ["96057", "96090"], "phase": "Phase 2"},
    "T17": {"units": ["96031", "96032"], "phase": "Phase 2"},
    "T18": {"units": ["96084", "96083"], "phase": "Phase 2"},
    "T19": {"units": ["96015", "96082"], "phase": "Phase 2"},
    "T20": {"units": ["96070", "96061"], "phase": "Phase 2"},
    "T21": {"units": ["96063", "96020"], "phase": "Phase 2"},
    "T22": {"units": ["96013", "96076"], "phase": "Phase 2"},
    "T23": {"units": ["96103", "96100"], "phase": "Phase 2"},
    "T24": {"units": ["96085", "96106"], "phase": "Phase 2"},
    "T25": {"units": ["96081", "96012"], "phase": "Phase 2"},
    "T26": {"units": ["96005", "96008"], "phase": "Phase 2"},
    "T27": {"units": ["96093", "96054"], "phase": "Phase 2"},
    "T28": {"units": ["96038", "96003"], "phase": "Phase 2"},
    "T29": {"units": ["96053", "96072"], "phase": "Phase 2"},
    "T30": {"units": ["96041", "96006"], "phase": "Phase 2"},
    "T31": {"units": ["96047", "96048"], "phase": "Phase 2"},

    # Phase 3: T32-T60
    "T32": {"units": ["96123", "96004"], "phase": "Phase 3"},
    "T33": {"units": ["96021", "96094"], "phase": "Phase 3"},
    "T34": {"units": ["96025", "96026"], "phase": "Phase 3"},
    "T35": {"units": ["96030", "96029"], "phase": "Phase 3"},
    "T36": {"units": ["96037", "96064"], "phase": "Phase 3"},
    "T37": {"units": ["96102", "96089"], "phase": "Phase 3"},
    "T38": {"units": ["96027", "96060"], "phase": "Phase 3"},
    "T39": {"units": ["96024", "96079"], "phase": "Phase 3"},
    "T40": {"units": ["96087", "96098"], "phase": "Phase 3"},
    "T41": {"units": ["96119", "96120"], "phase": "Phase 3"},
    "T42": {"units": ["96071", "96116"], "phase": "Phase 3"},
    "T43": {"units": ["96073", "96074"], "phase": "Phase 3"},
    "T44": {"units": ["96115", "96124"], "phase": "Phase 3"},
    "T45": {"units": ["96068", "96069"], "phase": "Phase 3"},
    "T46": {"units": ["96016", "96117"], "phase": "Phase 3"},
    "T47": {"units": ["96052", "96077"], "phase": "Phase 3"},
    "T48": {"units": ["96105", "96114"], "phase": "Phase 3"},
    "T49": {"units": ["96050", "96125"], "phase": "Phase 3"},
    "T50": {"units": ["96010", "96009"], "phase": "Phase 3"},
    "T51": {"units": ["96042", "96107"], "phase": "Phase 3"},
    "T52": {"units": ["96028", "96059"], "phase": "Phase 3"},
    "T53": {"units": ["96046", "96045"], "phase": "Phase 3"},
    "T54": {"units": ["96092", "96023"], "phase": "Phase 3"},
    "T55": {"units": ["96002", "96001"], "phase": "Phase 3"},
    "T56": {"units": ["96111", "96112"], "phase": "Phase 3"},
    "T57": {"units": ["96014", "96121"], "phase": "Phase 3"},
    "T58": {"units": ["96108", "96095"], "phase": "Phase 3"},
    "T59": {"units": ["96088", "96065"], "phase": "Phase 3"},
    "T60": {"units": ["96080", "96091"], "phase": "Phase 3"},
}

def get_car_types():
    """Fetch all car types from database"""
    response = supabase.table('car_types').select('*').execute()
    return {ct['name']: ct['id'] for ct in response.data}

def populate_trains():
    """Populate database with all trains"""
    print("=" * 60)
    print("POPULATING ALL 60 JUBILEE LINE TRAINS")
    print("=" * 60)

    car_types = get_car_types()
    print(f"\nCar types in database: {list(car_types.keys())}")

    created = 0
    updated = 0

    for train_id, info in TRAINS.items():
        train_num = int(train_id[1:])
        units = info['units']
        phase = info['phase']

        # Create train name
        train_name = f"{train_id} ({units[0][-3:]}-{units[1][-3:]})"

        print(f"\n{train_id}: Units {units[0]} & {units[1]} - {phase}")

        for unit_number in units:
            # Check if unit exists
            existing = supabase.table('train_units').select('id').eq('unit_number', unit_number).execute()

            if existing.data:
                # Update existing unit
                unit_id = existing.data[0]['id']
                supabase.table('train_units').update({
                    'train_name': train_name,
                    'train_number': train_num,
                    'phase': phase,
                }).eq('id', unit_id).execute()
                print(f"  Updated unit: {unit_number}")
                updated += 1
            else:
                # Create new unit
                result = supabase.table('train_units').insert({
                    'unit_number': unit_number,
                    'train_name': train_name,
                    'train_number': train_num,
                    'phase': phase,
                    'is_active': True,
                }).execute()
                print(f"  Created unit: {unit_number}")
                created += 1

    print("\n" + "=" * 60)
    print(f"COMPLETE: Created {created}, Updated {updated} units")
    print(f"Total trains: {len(TRAINS)}")
    print("=" * 60)

def list_all_trains():
    """List all trains currently in database"""
    response = supabase.table('train_units').select('*').order('train_number').execute()

    print("\n" + "=" * 60)
    print("TRAINS IN DATABASE")
    print("=" * 60)

    trains = {}
    for unit in response.data:
        tn = unit.get('train_number') or 0
        if tn not in trains:
            trains[tn] = []
        trains[tn].append(unit['unit_number'])

    for tn in sorted(trains.keys()):
        units = trains[tn]
        print(f"T{tn:02d}: {' & '.join(units)}")

    print(f"\nTotal: {len(trains)} trains, {len(response.data)} units")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--list':
        list_all_trains()
    else:
        populate_trains()
        print("\n")
        list_all_trains()
