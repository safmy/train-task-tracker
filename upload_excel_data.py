#!/usr/bin/env python3
"""
Script to upload Excel train data to Supabase
"""

import pandas as pd
from supabase import create_client
import os

# Supabase credentials
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

def clear_existing_data():
    """Clear existing train data"""
    print("Clearing existing data...")
    # Delete in order due to foreign keys
    supabase.table('task_completions').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('cars').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('train_units').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("Data cleared.")

def upload_excel(file_path):
    """Parse and upload Excel file to Supabase"""

    # Get car types mapping
    car_types = get_car_types()
    print(f"Car types: {list(car_types.keys())}")

    # Read Excel file
    xl = pd.ExcelFile(file_path)
    print(f"\nProcessing file: {file_path}")
    print(f"Sheets: {xl.sheet_names}")

    # Parse all sheets to identify units
    units_data = {}  # unit_number -> {car_type_name: {car_number, tasks}}

    for sheet_name in xl.sheet_names:
        if sheet_name == 'Sign Off Sheet':
            continue

        df = pd.read_excel(xl, sheet_name=sheet_name, header=None)

        # Get unit and car numbers from row 0
        unit_no = str(df.iloc[0, 0]).replace('Unit No: ', '').strip()
        car_no = str(df.iloc[0, 1]).replace('Car No: ', '').strip()

        print(f"\n  Sheet: {sheet_name}")
        print(f"    Unit: {unit_no}, Car: {car_no}")

        # Parse tasks starting from row 2 (skip header rows 0 and 1)
        tasks = []
        for idx in range(2, len(df)):
            task_name = df.iloc[idx, 0]
            description = df.iloc[idx, 1]
            completed = df.iloc[idx, 2]
            in_progress = df.iloc[idx, 3]
            date_val = df.iloc[idx, 4]
            initials = df.iloc[idx, 5]

            # Skip empty rows
            if pd.isna(task_name) or str(task_name).strip() == '':
                continue

            # Determine status
            status = 'pending'
            if pd.notna(completed) and str(completed).lower() == 'yes':
                status = 'completed'
            elif pd.notna(in_progress) and str(in_progress).lower() == 'yes':
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

    # Generate train name from unit numbers
    unit_numbers = sorted(units_data.keys())
    train_name = f"Train {'-'.join([u[-3:] for u in unit_numbers])}"
    print(f"\n  Train name: {train_name}")
    print(f"  Units: {unit_numbers}")

    # Upload to Supabase
    for unit_number in unit_numbers:
        # Create train unit
        print(f"\n  Creating unit: {unit_number}")
        unit_response = supabase.table('train_units').insert({
            'unit_number': unit_number,
            'train_name': train_name,
            'is_active': True
        }).execute()
        unit_id = unit_response.data[0]['id']
        print(f"    Unit ID: {unit_id}")

        # Create cars and tasks for this unit
        for car_type_name, car_data in units_data[unit_number].items():
            car_type_id = car_types.get(car_type_name)
            if not car_type_id:
                print(f"    WARNING: Car type '{car_type_name}' not found!")
                continue

            # Create car
            car_response = supabase.table('cars').insert({
                'unit_id': unit_id,
                'car_type_id': car_type_id,
                'car_number': car_data['car_number']
            }).execute()
            car_id = car_response.data[0]['id']
            print(f"    Created car: {car_type_name} (#{car_data['car_number']}) - {len(car_data['tasks'])} tasks")

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

    print(f"\nUpload complete!")

if __name__ == '__main__':
    # Clear existing data first
    clear_existing_data()

    # Upload the Excel file
    excel_path = '/Users/safmy/Desktop/Code_and_Scripts/REPOS/misc_files/Visual Management WTS/JLDO Work to Sheets(U094 & U021).xlsx'
    upload_excel(excel_path)
