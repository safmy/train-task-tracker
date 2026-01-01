#!/usr/bin/env python3
"""
Script to sync WorktoSheets Excel files from SharePoint to Supabase
Supports both .xlsx and .xlsm formats (V3.x WorktoSheets)
"""

import pandas as pd
from supabase import create_client
import os
import re
import sys
from pathlib import Path
from datetime import datetime

# Supabase configuration
SUPABASE_URL = "https://fsubmqjevlfpcirgsbhi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWJtcWpldmxmcGNpcmdzYmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNTgyNzgsImV4cCI6MjA2NDkzNDI3OH0.Hfo1kCUCVMvr2ffhLJ3rp7qLMchWYdmBkzOYcorQVQE"

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Sheet to car type mapping
SHEET_TO_CAR_TYPE = {
    'DM 3 CAR': 'DM 3 CAR',
    'Trailer 3 Car': 'Trailer 3 Car',
    'UNDM 3 CAR': 'UNDM 3 CAR',
    'DM 4 Car': 'DM 4 Car',
    'Trailer 4 Car': 'Trailer 4 Car',
    'Special Trailer 4 Car': 'Special Trailer 4 Car',
    'UNDM 4 Car': 'UNDM 4 Car'
}

def get_car_types():
    """Fetch all car types from database"""
    response = supabase.table('car_types').select('*').execute()
    return {ct['name']: ct['id'] for ct in response.data}

def extract_train_number(filename):
    """Extract train number (T1, T33, etc.) from filename"""
    patterns = [
        r'T(\d+)\s*-',       # "T33 -" or "T1 -"
        r'T(\d+)\s*\(',      # "T33 ("
        r'Train\s*(\d+)',    # "Train 33"
    ]
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None

def extract_unit_numbers(filename):
    """Extract unit numbers from filename"""
    units = []
    # Pattern for 5-digit units: 96021 & 96094
    matches = re.findall(r'(\d{5})\s*[&,]\s*(\d{5})', filename)
    for m in matches:
        units.extend(m)

    # Pattern for 3-digit short form: 067&122
    if not units:
        matches = re.findall(r'(\d{3})\s*[&,]\s*(\d{3})', filename)
        for m in matches:
            units.extend(['96' + u for u in m])

    return list(set(units))

def extract_phase(filepath):
    """Extract phase from file path"""
    path_str = str(filepath)
    # Look for "Phase X" pattern
    match = re.search(r'Phase\s*(\d+)', path_str, re.IGNORECASE)
    if match:
        return f"Phase {match.group(1)}"
    return None

def parse_worktosheet(file_path):
    """Parse a WorktoSheets Excel file"""
    filename = os.path.basename(file_path)
    print(f"\nProcessing: {filename}")

    # Extract metadata from filename
    train_number = extract_train_number(filename)
    file_units = extract_unit_numbers(filename)
    phase = extract_phase(file_path)

    print(f"  Train Number: T{train_number}" if train_number else "  Train Number: Unknown")
    print(f"  Units from filename: {file_units}" if file_units else "  Units from filename: Unknown")
    print(f"  Phase: {phase}" if phase else "  Phase: Unknown")

    # Read Excel file
    try:
        xl = pd.ExcelFile(file_path)
    except Exception as e:
        print(f"  ERROR: Could not read file: {e}")
        return None

    print(f"  Sheets: {xl.sheet_names}")

    # Parse all sheets to identify units
    units_data = {}

    for sheet_name in xl.sheet_names:
        if sheet_name == 'Sign Off Sheet':
            continue

        # Skip sheets that aren't car types
        if sheet_name not in SHEET_TO_CAR_TYPE:
            continue

        try:
            df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
        except Exception as e:
            print(f"  WARNING: Could not read sheet {sheet_name}: {e}")
            continue

        if len(df) < 2:
            continue

        # Get unit and car numbers from row 0
        # Handle different formats: "Unit No: 96094" or just unit number
        unit_cell = str(df.iloc[0, 0]) if pd.notna(df.iloc[0, 0]) else ''
        car_cell = str(df.iloc[0, 1]) if pd.notna(df.iloc[0, 1]) else ''

        unit_no = unit_cell.replace('Unit No:', '').replace('Unit:', '').strip()
        car_no = car_cell.replace('Car No:', '').replace('Car:', '').strip()

        # If unit_no is empty or invalid, try to extract from filename
        if not unit_no or not unit_no.isdigit():
            continue

        print(f"  Sheet: {sheet_name} - Unit: {unit_no}, Car: {car_no}")

        # Parse tasks starting from row 2 (skip header rows 0 and 1)
        tasks = []
        for idx in range(2, len(df)):
            task_name = df.iloc[idx, 0]
            description = df.iloc[idx, 1] if len(df.columns) > 1 else None
            completed = df.iloc[idx, 2] if len(df.columns) > 2 else None
            in_progress = df.iloc[idx, 3] if len(df.columns) > 3 else None
            date_val = df.iloc[idx, 4] if len(df.columns) > 4 else None
            initials = df.iloc[idx, 5] if len(df.columns) > 5 else None

            # Skip empty rows
            if pd.isna(task_name) or str(task_name).strip() == '':
                continue

            # Determine status
            status = 'pending'
            if pd.notna(completed) and str(completed).lower() in ['yes', 'y', '1', 'true']:
                status = 'completed'
            elif pd.notna(in_progress) and str(in_progress).lower() in ['yes', 'y', '1', 'true']:
                status = 'in_progress'

            # Parse initials
            initials_list = []
            if pd.notna(initials):
                initials_list = [i.strip().upper() for i in str(initials).replace('/', ',').split(',') if i.strip()]

            tasks.append({
                'task_name': str(task_name).strip(),
                'description': str(description).strip() if pd.notna(description) else '',
                'status': status,
                'completed_by': initials_list
            })

        print(f"    Tasks: {len(tasks)}")

        # Store in units_data
        if unit_no not in units_data:
            units_data[unit_no] = {}

        units_data[unit_no][sheet_name] = {
            'car_number': car_no,
            'tasks': tasks
        }

    return {
        'train_number': train_number,
        'phase': phase,
        'units_data': units_data
    }

def upload_to_supabase(parsed_data, car_types):
    """Upload parsed data to Supabase"""
    if not parsed_data or not parsed_data['units_data']:
        print("  No data to upload")
        return

    units_data = parsed_data['units_data']
    train_number = parsed_data['train_number']
    phase = parsed_data['phase']

    # Generate train name from unit numbers
    unit_numbers = sorted(units_data.keys())
    train_name = f"Train {'-'.join([u[-3:] for u in unit_numbers])}"
    if train_number:
        train_name = f"T{train_number} ({train_name})"

    print(f"\n  Uploading to Supabase...")
    print(f"  Train name: {train_name}")
    print(f"  Units: {unit_numbers}")

    for unit_number in unit_numbers:
        # Check if unit exists
        existing = supabase.table('train_units').select('id').eq('unit_number', unit_number).execute()

        if existing.data:
            unit_id = existing.data[0]['id']
            # Update existing unit
            supabase.table('train_units').update({
                'train_name': train_name,
                'train_number': train_number,
                'phase': phase,
                'last_synced_at': datetime.now().isoformat()
            }).eq('id', unit_id).execute()
            print(f"    Updated unit: {unit_number}")

            # Delete existing cars and task completions for this unit
            cars = supabase.table('cars').select('id').eq('unit_id', unit_id).execute()
            for car in cars.data:
                supabase.table('task_completions').delete().eq('car_id', car['id']).execute()
            supabase.table('cars').delete().eq('unit_id', unit_id).execute()
        else:
            # Create new unit
            result = supabase.table('train_units').insert({
                'unit_number': unit_number,
                'train_name': train_name,
                'train_number': train_number,
                'phase': phase,
                'is_active': True,
                'last_synced_at': datetime.now().isoformat()
            }).execute()
            unit_id = result.data[0]['id']
            print(f"    Created unit: {unit_number}")

        # Create cars and tasks for this unit
        for car_type_name, car_data in units_data[unit_number].items():
            car_type_id = car_types.get(car_type_name)
            if not car_type_id:
                print(f"    WARNING: Car type '{car_type_name}' not found!")
                continue

            # Create car
            car_result = supabase.table('cars').insert({
                'unit_id': unit_id,
                'car_type_id': car_type_id,
                'car_number': car_data['car_number']
            }).execute()
            car_id = car_result.data[0]['id']

            # Create task completions
            for idx, task in enumerate(car_data['tasks']):
                supabase.table('task_completions').insert({
                    'car_id': car_id,
                    'task_name': task['task_name'],
                    'description': task['description'],
                    'status': task['status'],
                    'completed_by': task['completed_by'],
                    'sort_order': idx + 1
                }).execute()

            print(f"    Created car: {car_type_name} (#{car_data['car_number']}) - {len(car_data['tasks'])} tasks")

    print(f"\n  Upload complete!")

def process_file(file_path):
    """Process a single WorktoSheets file"""
    # Get car types
    car_types = get_car_types()
    print(f"Car types: {list(car_types.keys())}")

    # Parse the file
    parsed_data = parse_worktosheet(file_path)

    if parsed_data:
        # Upload to Supabase
        upload_to_supabase(parsed_data, car_types)
    else:
        print("Failed to parse file")

def process_folder(folder_path):
    """Process all WorktoSheets files in a folder"""
    folder = Path(folder_path)
    files = list(folder.glob('**/*ork*heet*.xls*'))

    print(f"Found {len(files)} WorktoSheets file(s)")

    car_types = get_car_types()

    for file_path in files:
        parsed_data = parse_worktosheet(str(file_path))
        if parsed_data:
            upload_to_supabase(parsed_data, car_types)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python sync_worksheets.py <file_or_folder_path>")
        print("\nExamples:")
        print("  python sync_worksheets.py 'WorktosheetsV3.1 T1 - 067&122.xlsm'")
        print("  python sync_worksheets.py /path/to/downloads/")
        sys.exit(1)

    path = sys.argv[1]

    if os.path.isfile(path):
        process_file(path)
    elif os.path.isdir(path):
        process_folder(path)
    else:
        print(f"Error: Path not found: {path}")
        sys.exit(1)
