#!/usr/bin/env python3
"""
Train Unit Mapping - Extract from SharePoint folder names
Based on the pattern observed:
- Phase 1: T01-T06
- Phase 2: T07-T31
- Phase 3: T32-T62
"""

# From the HTML snippets you provided, I can extract these mappings:
# Each train has a 3-car unit and a 4-car unit

TRAIN_UNITS = {
    # Phase 1: T01-T06
    "T01": ("96067", "96122"),
    "T02": ("96051", "96062"),
    "T03": ("96099", "96104"),
    "T04": ("96075", "96118"),
    "T05": ("96113", "96018"),
    "T06": ("96017", "96078"),

    # Phase 2: T07-T31 (need to fill in from SharePoint)
    "T07": ("96011", "96040"),
    "T08": None,
    "T09": None,
    "T10": None,
    "T11": None,
    "T12": None,
    "T13": None,
    "T14": None,
    "T15": None,
    "T16": None,
    "T17": None,
    "T18": None,
    "T19": None,
    "T20": None,
    "T21": None,
    "T22": None,
    "T23": None,
    "T24": None,
    "T25": None,
    "T26": None,
    "T27": None,
    "T28": None,
    "T29": None,
    "T30": None,
    "T31": None,

    # Phase 3: T32-T62 (need to fill in from SharePoint)
    "T32": ("96123", "96004"),
    "T33": ("96021", "96094"),  # From earlier conversation
    "T34": None,
    "T35": None,
    "T36": None,
    "T37": None,
    "T38": None,
    "T39": None,
    "T40": None,
    "T41": None,
    "T42": None,
    "T43": None,
    "T44": None,
    "T45": None,
    "T46": None,
    "T47": None,
    "T48": None,
    "T49": None,
    "T50": None,
    "T51": None,
    "T52": None,
    "T53": None,
    "T54": None,
    "T55": None,
    "T56": None,
    "T57": None,
    "T58": None,
    "T59": None,
    "T60": None,
    "T61": None,
    "T62": None,
}

# Phase folder patterns (from URLs)
PHASE_FOLDERS = {
    1: "Phase 1 - T01-T06 - Program Lift (Bogies, Line Contactors & Catch Back) )",
    2: "Phase 2 - T07 - T31 - Program Lift (P1, P2 & Catch Back)",
    3: "Phase 3 - T32 - T62 - Program Lift (P1, P2, P3, P3.1, P3.2 P3.3 & Catch Back))",
}

# Work to Sheets folder patterns (varies by phase)
WORKSHEETS_FOLDERS = {
    1: "05 Work To Sheets TFOS - Phase One A",
    2: "05 Work To Sheets TFOS - Phase One A",
    3: "05 Work To Sheets TFOS",
}

def get_phase(train_num):
    """Get phase number from train number"""
    if train_num <= 6:
        return 1
    elif train_num <= 31:
        return 2
    else:
        return 3

def build_sharepoint_url(train_num, units):
    """Build SharePoint URL for a train's worksheet"""
    phase = get_phase(train_num)
    phase_folder = PHASE_FOLDERS[phase]
    worksheets_folder = WORKSHEETS_FOLDERS[phase]

    train_id = f"T{train_num:02d}"
    unit1, unit2 = units

    # Train folder format: "T01 - (Units 96067 and 96122)"
    train_folder = f"{train_id} - (Units {unit1} and {unit2})"

    # Filename format varies:
    # Short form: "WorktosheetsV3.1 T1 - 067&122.xlsm"
    # Long form: "WorktosheetsV3 T32 - (Units 96123 & 96004).xlsm"
    short_unit1 = unit1[-3:]  # Last 3 digits
    short_unit2 = unit2[-3:]

    # Build base URL
    base = "https://transportforlondon.sharepoint.com/sites/jllew/Shared Documents/Train Records"

    from urllib.parse import quote

    path = f"{base}/{phase_folder}/{train_folder}/{worksheets_folder}"
    encoded_path = quote(path, safe='/:')

    return {
        "train": train_id,
        "phase": phase,
        "units": units,
        "folder_url": encoded_path,
        "train_folder": train_folder,
    }

def print_known_trains():
    """Print all known train mappings"""
    print("=" * 60)
    print("KNOWN TRAIN MAPPINGS")
    print("=" * 60)

    for phase in [1, 2, 3]:
        print(f"\n--- Phase {phase} ---")
        for train_id, units in TRAIN_UNITS.items():
            train_num = int(train_id[1:])
            if get_phase(train_num) == phase:
                if units:
                    print(f"  {train_id}: Units {units[0]} & {units[1]}")
                else:
                    print(f"  {train_id}: [MISSING]")

def print_missing_trains():
    """Print trains that need unit numbers"""
    print("\n" + "=" * 60)
    print("MISSING TRAIN MAPPINGS (need to extract from SharePoint)")
    print("=" * 60)

    missing = [tid for tid, units in TRAIN_UNITS.items() if units is None]
    print(f"\nTotal missing: {len(missing)}")
    print("Trains: " + ", ".join(missing))

def export_for_userscript():
    """Export known mappings as JSON for the userscript"""
    import json

    known = {k: v for k, v in TRAIN_UNITS.items() if v is not None}

    print("\n" + "=" * 60)
    print("JSON FOR USERSCRIPT")
    print("=" * 60)
    print(json.dumps(known, indent=2))

if __name__ == "__main__":
    print_known_trains()
    print_missing_trains()
    export_for_userscript()

    print("\n" + "=" * 60)
    print("INSTRUCTIONS")
    print("=" * 60)
    print("""
To complete the mapping:
1. Navigate to each Phase folder in SharePoint
2. Copy the train folder names (e.g., "T08 - (Units 96XXX and 96XXX)")
3. Paste them here and I'll extract the unit numbers

Or provide a screenshot/HTML of the Phase 2 and Phase 3 folder listings.
""")
