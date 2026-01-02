import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { TrendingUp, Users, CheckCircle, Clock, Target, Award, Filter, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

const DB_NAME = 'TrainTrackerDB'
const DB_VERSION = 1
const STORE_NAME = 'dashboardCache'

// IndexedDB helpers - provides ~50MB+ storage instead of localStorage's 5MB limit
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

const getCacheFromDB = async () => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get('dashboardData')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  } catch (e) {
    console.error('Error reading from IndexedDB:', e)
    return null
  }
}

const saveCacheToDB = async (cars, completions) => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const data = {
        id: 'dashboardData',
        cars,
        completions,
        timestamp: new Date().toISOString()
      }
      const request = store.put(data)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        console.log('Cache saved to IndexedDB, records:', {
          cars: cars.length,
          completions: completions.length
        })
        resolve()
      }
    })
  } catch (e) {
    console.error('Error saving to IndexedDB:', e)
  }
}

const clearCacheFromDB = async () => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete('dashboardData')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch (e) {
    console.error('Error clearing IndexedDB:', e)
  }
}

// Team roster - who belongs to each team
const TEAM_ROSTER = {
  'Team A': ['AS', 'JT', 'CB', 'JD', 'KM', 'CP', 'KA'],
  'Team B': ['LN', 'NA', 'PS', 'AOO', 'JN', 'DK', 'DH', 'JL'],
  'Team C': ['SC', 'MA', 'CC', 'OM', 'AL', 'VN', 'RN', 'LVN'],
  'Team D': ['SA', 'MR', 'AR', 'DB', 'GT', 'UQ', 'BP', 'RB'],
  'TFOS': ['TFOS'] // Unknown person - needs manual identification
}

// Task name -> Number of people mapping (from Excel column M)
// This multiplier is needed for accurate efficiency calculation
// A 7-hour job with 2 people = 14 man-hours of work
const TASK_PEOPLE_MAP = {
  "DM UNDERFRAME REMOVE/REFIT MORS SMITT RELAYS": 1,
  "DM CAB DRIVERS SIDE REMOVE/REFIT EMERGENCY LIGHT INVERTER": 1,
  "DM CAB NON DRIVERS SIDE REMOVE/REFIT EMERGENCY LIGHT INVERTER": 1,
  "DM  SALOON REMOVE/REFIT EMERGENCY LIGHT INVERTERS": 1,
  "DM CAB NON DRIVERS SIDE REMOVE/REFIT SIEMENS RELAYS": 1,
  "DM CAB DRIVERS SIDE REMOVE/REFIT SIEMENS RELAYS": 1,
  "DM CAR REMOVE/REFIT 4 POLE CIRCUIT BREAKER": 2,
  "DM CAB DRIVERS SIDE REMOVE/REFIT ROTARY SWITCHES": 1,
  "DM CAB NON DRIVERS SIDE REMOVE/REFIT ROTARY SWITCHES": 1,
  "DM CAR REMOVE/REFIT AUXILIARY SUPPLY BREAKER (ASB)": 1,
  "DM CAB NON DRIVERS SIDE REMOVE/REFIT MCBS": 1,
  "DM  SALOON REMOVE/REFIT MCBS": 1,
  "DM CAB DRIVERS SIDE REMOVE/REFIT MORS SMITT RELAY": 1,
  "DM CAB NON DRIVERS SIDE REMOVE/REFIT MORS SMITT RELAYS": 1,
  "DM  SALOON REMOVE/REFIT MORS SMITT RELAYS": 1,
  "DM - TRACTION CUT-OUT SWITCH": 1,
  "DM - SHED SUPPLY SWITCH AND RECEPTACLE ASSEMBLY": 1,
  "DM - CAR REMOVE/REFIT SHOEGEAR VOLTAGE & REVERSE VOLTAGE RELAY": 2,
  "DM - REMOVE/REFIT CURRENT LIMITING INDUCTOR": 2,
  "DM - CURRENT LINK FILTER INDUCTOR (AUXILIARY LINK FILTER INDUCTOR)": 2,
  "DM - CAR REMOVE/REFIT LINE FILTER INDUCTOR": 1,
  "DM - CONTROL SUPPLY RESISTOR (CSZ)": 2,
  "DM - AUXILIARY STEP-DOWN CHOPPER SNUBBER RESISTOR": 1,
  "DM CAR REMOVE BOGIE A": 4,
  "DM CAR REFIT BOGIE A": 4,
  "DM CAR REMOVE BOGIE D": 4,
  "DM CAR REFIT BOGIE D": 4,
  "DM UNDERFRAME REMOVE/REFIT LINE BREAKER CONTACTOR 1 AND 3": 2,
  "DM UNDERFRAME REMOVE/REFIT LINE BREAKER CONTACTOR 2 AND 4": 2,
  "DM CAR REMOVE/REFIT FILTER HARD CROWBAR THYRISTOR ASSEMBLY": 1,
  "DM CAR REMOVE/REFIT POWER SUPPLY UNIT": 2,
  "DM UNDERFRAME LOCATION 412 REMOVE/REFIT AUXILIARY CONVERTER ELECTRONIC MODULE": 2,
  "DM CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE A": 2,
  "DM CAR REMOVE/REFIT PARKING BRAKE DROP HOSE A": 2,
  "DM CAR REMOVE/REFIT SLEETBRUSH DROP HOSE (POSITIVE)": 1,
  "DM CAR REMOVE/REFIT SLEETBRUSH DROP HOSE (NEGATIVE)": 1,
  "DM CAR REMOVE/REFIT SLEETBRUSH CYLINDER HOSE (POSITIVE)": 1,
  "DM CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE D": 2,
  "DM CAR REMOVE/REFIT PARKING BRAKE DROP HOSE D": 2,
  "DM - WHEEL SPEED PROBE - MOTOR": 1,
  "DM -  REMOVE/REFIT LINE CONTACTOR AIR SUPPLY": 2,
  "DM CAR REMOVE/REFIT UNCOUPLER SWITCH DM": 2,
  "DM CAR REMOVE/REFIT PROPULSION INVERTER MODULE": 2,
  "DM CAR REMOVE/REFIT LINE FILTER CAPACITOR TRAY 10 CAP": 2,
  "DM CAR REMOVE/REFIT LINE FILTER CAPACITOR TRAY 7 CAP - ALFK": 2,
  "DM CAR REMOVE/REFIT AUXILIARY INVERTER AND RHEOSTATIC BRAKE MODULE": 2,
  "DM CAB REMOVE/REFIT TRACTION BRAKE CONTROLLER": 2,
  "DM SALOON REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 1 (FOR ALL CARS)": 1,
  "DM CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 2 (FOR DM/UNDM)": 1,
  "DM CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (VLCV / SYSTEM DRAIN / AUTO DRAIN / WHISLTE)": 1,
  "DM UNDERFRAME REMOVE/REFIT VARIABLE LOAD VALVE - DM/UNDM CAR": 1,
  "DM UNDERFRAME CAR REMOVE/REFIT BRAKE RELEASE VALVE": 2,
  "DM SALOON REMOVE/REFIT BRAKE CYLINDER SALOON GAUGES": 1,
  "DM CAR REMOVE/REFIT CLOSED LOOP ANALOGUE UNIT (CLAU) - DM/UNDM CAR": 1,
  "DM CAR REMOVE/REFIT PNEUMATIC BRAKE DRIVER": 1,
  "DM CAR REMOVE/REFIT ¾\" GANGED VENTED COCKS (BCIC/PBIC)": 2,
  "DM CAR REMOVE/REFIT ENCODER UNIT": 2,
  "DM UNDERFRAME REMOVE/REFIT WSP DUMP VALVE": 1,
  "DM CAR REMOVE/REFIT WHISTLE - TYPE 3C (ENHANCED)": 1,
  "DM CAR REMOVE/REFIT 5/3 WHISTLE SPOOL VALVE DM": 1,
  "DM CAR REMOVE/REFIT WHISTLE CONTROL LEVER VALVE DM DRIVER'S SIDE/INSTRUCTOR SIDE (X 2)": 2,
  "DM CAR REMOVE/REFIT WHISTLE-OPERATED PRESSURE SWITCH DM": 1,
  "DM CAR REMOVE/REFIT TRACTION SUPPLY PRESSURE REGULATOR": 1,
  "DM CAR REMOVE/REFIT DOOR AIR SUPPLY PRESSURE REGULATOR (SUPPLIED WITH O-RINGS)": 1,
  "DM CAR REMOVE/REFIT LOW MAIN LINE PRESSURE SWITCH": 1,
  "DM CAR REMOVE/REFIT COUPLING-TEST POINT-QUICK RELEASE": 1,
  "DM CAR REMOVE/REFIT MAINLINE CAB GAUGE": 1,
  "DM CAR REMOVE/REFIT PRESSURE GAUGE (DOOR/TRACTION SUPP)": 1,
  "DM CAR REMOVE/REFIT AIR FILTER WITH AUTOMATIC DRAIN": 1,
  "DM CAR REMOVE/REFIT BSR CHECK VALVE (SUPPLIED WITH O-RINGS)": 1,
  "DM CAR REMOVE/REFIT MAINLINE PRESSURE SWITCH EP TEST VALVE": 1,
  "DM CAR REMOVE/REFIT ½\" CHECK VALVE (SHOEGEAR AND LINEBREAKER AUX), SUPPLIED WITH O-RINGS": 1,
  "DM CAR REMOVE/REFIT ½\" CHECK VALVE (SHOEGEAR MANUAL CONTROL VALVE), SUPPLIED WITH O-RINGS": 1,
  "DM CAR REMOVE/REFIT ½\" CHECK VALVE (EXTERNAL AIR SUPPLY), SUPPLIED WITH O-RINGS": 1,
  "DM CAR REMOVE/REFIT DOUBLE CHECK VALVE": 1,
  "DM CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (VLCV / SYSTEM DRAIN / WHISTLE)": 1,
  "DM CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (FLANGE MOUNTED)": 1,
  "DM CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE A": 1,
  "DM CAR REMOVE/REFIT SLEET BRUSH CONTROL VALVE": 1,
  "DM CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE D": 1,
  "DM CAR REMOVE/REFIT CURRENT BALANCE DETECTOR RELAY (CBR)": 1,
  "DM - CAR REMOVE/REFIT RHEOSTATIC BRAKE RESISTOR FAN ASSEMBLY": 2,
  "DM - CAR REMOVE/REFIT REVERSE VOLTAGE RELAY FUSE": 3,
  "DM - CAR REMOVE/REFIT SHOE VOLTAGE RELAY FUSE 1 & 2 (SVRF 1 & 2)": 4,
  "DM CAR REMOVE/REFIT 5/3 WHISTLE CONTROL LEVER VALVE DM NON DRIVER'S SIDE": 2,
  "DM CAR REMOVE/REFIT AUTOCOUPLER, DRAWGEAR, RADIAL SUPPORT BAR, LEFT AND RIGHT HAND CONTACT BOXES": 4,
  "DM CAR REMOVE/REFIT SEMI PERMANENT COUPLER BAR AND DRAWGEAR INTERMEDIATE A": 4,
  "DM CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY": 2,
  "DM CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY INTERMEDIATE": 2,
  "DM CAR REMOVE/REFIT LINE CURRENT MONITORING DEVICE": 2,
  "DM CAB REMOVE/REFIT CAB DESK HEATER": 1,
  "DM CAB REMOVE/REFIT CAB REFRIGERATION UNIT (CHILLER MODULE)": 2,
  "DM CAB REMOVE/REFIT CAB AIR HANDLING UNIT (AHU)": 2,
  "DM CAR REMOVE/REFIT BRAKE SUPPLY RESERVOIR": 2,
  "DM CAR REMOVE/REFIT COUPLER HOSE / SEMI-PERM COUPLER HOSE": 2,
  "DM UNDERFRAME REMOVE/REFIT DM COUPLER HOSES": 1,
  "DM CAR REMOVE/REFIT 20 KHZ DISTRIBUTION PANEL": 1,
  "DM CAR REMOVE/REFIT POWER SUPPLY UNIT ISOLATION SWITCH": 1,
  "DM CAR REMOVE/REFIT SCREENWASH STAINLESS PIPE ASSY": 1,
  "DM CAR REMOVE/REFIT WASHER NOZZLE LH AND RH": 1,
  "DM CAR REMOVE/REFIT AUXILIARY ISOLATION SWITCH": 2,
  "DM - CAR REMOVE/REFIT AUXILIARY SUPPLY ISOLATION TRANSFORMER": 2,
  "DM - CAR REMOVE/REFIT FILTER VOLTAGE MONITORING DEVICES VMD1, FVMD2, FVMD1, ALVMD.": 1,
  "DM - CAR REMOVE/REFIT CAPACITOR PANEL ASSEMBLY": 2,
  "DM - SHED SUPPLY FUSE": 2,
  "DM - REMOVE AND REFIT CURRENT MONITORING DEVICES (CMDA, CMDB, CMDC)": 2,
  "DM  - REMOVE/REFIT SALOON MODULAR SEATING - CATCH PLATE, GAS STRUT, SEAL, PINS, SPACE COVER AND INSULATION BLANKET": 4,
  "DM - CAR REPLACE CAB BACK WALL FASTNERS": 2,
  "DM - REMOVE/REFIT AUXLIARY LINK CURRENT MONITORING DEVICE (ALCMD)": 2,
  "DM - WIPER MOTOR": 2,
  "DM  - REMOVE/REFIT SALOON MODULAR SEATING - SEAT LOCK SPRING AND PIN SPRINGS": 2,
  "DM CAR REMOVE/REFIT TMCU - TRAIN MANAGEMENT CONTROL UNIT": 1,
  "DM CAR REMOVE/REFIT CAB AUDIO VISUAL UNIT (CAVU)": 1,
  "DM CAR REMOVE/REFIT SALOON AUDIO VISUAL UNIT (SAVU)": 1,
  "DM CAR REMOVE/REFIT TMCC - TRAIN MANAGEMENT CAR CONTROLLER": 1,
  "DM CAR REMOVE/REFIT TMWD - TRAIN MANAGEMENT WALL DISPLAY": 1,
  "DM  REMOVE/REFIT TMRT - TRAIN MANAGEMENT REMOTE TERMINAL": 1,
  "DM - CAR REMOVE/REFIT SIGNAL RESISTOR PANEL": 1,
  "DM - CAR REMOVE/REFIT EQUIPMENT GOVERNOR": 2,
  "DM - CAR REMOVE/REFIT TRAIN OPERATOR DISPLAY-CONTROL UNIT (TOD-CU)": 1,
  "DM - CAR REMOVE/REFIT MASTER CONTROL SWITCH (MCS)": 1,
  "DM - CAR REMOVE/REFIT OUTPUT FILTER PANELS": 2,
  "DM - REMOVE/REFITCAR SCREEN WASH TANK & PUMP": 3,
  "DM - ASK CAPAICTOR REPLACE": 2,
  "DM - CAR REMOVE/REFIT AUXLIARY SUPPLY CONTACTOR (ASC)": 2,
  "DM - CHECK MAINLINE PRESSURE SWITCH EP TEST VALVE, LOW MAINLINE PRESSURE SWITCH, DRIVER SIDE WHISTLE CONTROL LEVER AND DOUBLE CHECK VALVE FITTINGS AND REPLACE ALL UNITS THAT HAVE THE UNAPPROVED PNEUMATIC BLUE SEAL FITTED WITH THE NORGREN SEALS": 2,
  "TRIALER  UNDERFRAME REMOVE/REFIT CONTACTORS SA80": 2,
  "TRAILER  SALOON REMOVE/REFIT EMERGENCY LIGHT INVERTERS": 1,
  "TRAILER  SALOON REMOVE/REFIT MCBS": 1,
  "TRAILER SALOON REMOVE/REFIT MORS SMITT RELAYS": 1,
  "TRAILER CAR REMOVE BOGIE A": 4,
  "TRAILER CAR REFIT BOGIE A": 4,
  "TRAILER CAR REMOVE BOGIE D": 4,
  "TRAILER CAR REFIT BOGIE D": 4,
  "TRAILER CAR REMOVE/REFIT WSP CONTROL UNIT": 1,
  "TRAILER CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE BOGIE A": 2,
  "TRAILER CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE BOGIE D": 2,
  "TRAILER - AXLE-END SPEED PROBE HOUSING (WSP)": 1,
  "TRAILER CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 1 (ALL CARS)": 1,
  "TRAILER CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 2 (FOR TR CARS)": 1,
  "TRAILER CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (VLCV / SYSTEM DRAIN / AUTO DRAIN / WHISTLE)": 1,
  "TRAILER CAR REMOVE/REFIT VARIABLE LOAD VALVE - T/DIT CAR": 1,
  "TRAILER CAR REMOVE/REFIT BRAKE RELEASE VALVE": 2,
  "TRAILER CAR REMOVE/REFIT BRAKE CYLINDER SALOON GAUGES": 1,
  "TRAILER CAR REMOVE/REFIT CLOSED LOOP ANALOGUE UNIT (CLAU) - T/ DIT CAR": 1,
  "TRAILER CAR REMOVE/REFIT PNEUMATIC BRAKE DRIVER": 1,
  "TRAILER CAR REMOVE/REFIT ¾\" VENTED BALL VALVE (BCIC)": 1,
  "TRAILER CAR REMOVE/REFIT WSP DUMP VALVE - TRAILER": 1,
  "TRAILER CAR REMOVE/REFIT DOOR AIR SUPPLY PRESSURE REGULATOR (SUPPLIED WITH O-RINGS)": 1,
  "TRAILER CAR REMOVE/REFIT COMPRESSOR DELIVERY HOSE": 2,
  "TRAILER CAR REMOVE/REFIT 1/2\" SILENCER (EXHAUST)": 1,
  "TRAILER CAR REMOVE/REFIT LOW COMPRESSOR DELIVERY PRESSURE SWITCH": 1,
  "TRAILER CAR REMOVE/REFIT COMPRESSOR GOVERNOR": 1,
  "TRAILER CAR REMOVE/REFIT COUPLING-TEST POINT-QUICK RELEASE": 1,
  "TRAILER CAR REMOVE/REFIT PRESSURE GAUGE (DOOR/TRACTION SUPP)": 1,
  "TRAILER CAR REMOVE/REFIT AIR FILTER WITH AUTOMATIC DRAIN": 1,
  "TRAILER CAR REMOVE/REFIT MAINLINE RESERVOIR SAFETY VALVE": 1,
  "TRAILER CAR REMOVE/REFIT COMPRESSOR NON-RETURN VALVE": 1,
  "TRAILER CAR REMOVE/REFIT BSR CHECK VALVE (SUPPLIED WITH O-RINGS)": 1,
  "TRAILER CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (FLANGE MOUNTED)": 1,
  "TRAILER CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE A": 1,
  "TRAILER CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE D": 1,
  "TRAILER CAR REMOVE/REFIT FUSES (PERMANENT LOAD PROTECTION, BARE ESSENTIALS PROTECTION, EMERGENCY 1 PROTECTION & EMERGENCY 2 PROTECTION)": 2,
  "TRAILER CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY INTERMEDIATE A END": 2,
  "DO NOT FILL - DUPLICATE - TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE A END & SEMI PERMANENT COUPLER BAR": 4,
  "TRAILER CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY INTERMEDIATE D END": 2,
  "DO NOT FILL - DUPLICATE - TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE D END & SEMI-PERMANENT COUPLER BAR": 4,
  "TRAILER CAR REMOVE/REFIT MAIN RESERVOIR": 2,
  "TRAILER CAR REMOVE/REFIT BRAKE SUPPLY RESERVOIR": 2,
  "TRAILER CAR REMOVE/REFIT UNDM COUPLER HOSE / SEMI-PERM COUPLER HOSE": 2,
  "TRAILER CAR REMOVE/REFIT AUTOMATIC DRAIN VALVE (G 1/2\")": 1,
  "TRAILER CAR REMOVE/REFIT 3-WAY BALL VALVE": 1,
  "TRAILER CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (MAIN RESERVOIR MANUAL DRAIN VALVE)": 1,
  "TRAILER REMOVE/REFIT BATTERY SUPPLY CAPACITORS (BSK 1, 2, 3)  NON ELECTROLYTIC CAPACITOR": 2,
  "TRAILER CAR REMOVE/REFIT BATTERY RECTIFIER CAPACITOR (BRK)  NON ELECTROLYTIC CAPACITOR": 2,
  "TRAILER - CAR - REMOVE/REFIT BATTERY ISOLATION CONTACTORS N(C-BIC1 AND C-BIC 2)": 2,
  "TRAILER -  REMOVE/REFIT BATTERY CURRENT MONITORING DEVICE": 2,
  "TRAILER -REMOVE/REFIT SALOON MODULAR SEATING - CATCH PLATE, GAS STRUT, SEAL, PINS, SPACE COVER AND INSULATION BLANKET": 4,
  "TRAILER - REMOVE/REFIT SALOON MODULAR SEATING - SEAT LOCK SPRING AND PIN SPRINGS": 2,
  "TRAILER CAR REMOVE/REFIT SALOON AUDIO VISUAL UNIT (SAVU)": 1,
  "TRAILER CAR REMOVE/REFIT 5 X TRAIN MANAGEMENT REMOTE TERMINALS.": 1,
  "TRAILER - REPLACE 5 X RELAY TIMERS WITH 5 X ARTECHE RELAYS, INCULDING WIRING MODIFICATION.": 1,
  "UNDM UNDERFRAME REMOVE/REFIT CONTACTOR  SA80": 2,
  "UNDM UNDERFRAME REMOVE/REFIT MORS SMITT RELAYS": 1,
  "UNDM SALOON  REMOVE/REFIT EMERGENCY LIGHT INVERTERS": 1,
  "UNDM SALOON REMOVE/REFIT SIEMENS RELAYS": 1,
  "UNDM SALOON REMOVE/REFIT MCBS": 1,
  "UNDM SALOON REMOVE/REFIT MORS SMITT RELAYS": 1,
  "UNDM - TRACTION CUT-OUT SWITCH": 1,
  "UNDM - SHED SUPPLY SWITCH AND RECEPTACLE ASSEMBLY": 1,
  "UNDM - CURRENT LINK FILTER INDUCTOR (AUXILIARY LINK FILTER INDUCTOR)": 2,
  "UNDM - REMOVE/REFIT CURRENT LIMITING INDUCTOR": 2,
  "UNDM -CAR REMOVE/REFIT LINE FILTER INDUCTOR": 1,
  "UNDM - CONTROL SUPPLY RESISTOR (CSZ)": 2,
  "UNDM CAR REMOVE BOGIE A": 4,
  "UNDM CAR REFIT BOGIE A": 4,
  "UNDM CAR REMOVE BOGIE D": 4,
  "UNDM CAR REFIT BOGIE D": 4,
  "UNDM CAR REMOVE/REFIT LINE BREAKER CONTACTOR 1 AND 3": 2,
  "UNDM CAR REMOVE/REFIT LINE BREAKER CONTACTOR 2 AND 4": 2,
  "UNDM CAR REMOVE/REFIT FILTER HARD CROWBAR THYRISTOR ASSEMBLY": 1,
  "UNDM CAR REMOVE/REFIT POWER SUPPLY UNIT": 2,
  "UNDM CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE BOGIE A": 2,
  "UNDM CAR REMOVE/REFIT PARKING BRAKE DROP HOSE BOGIE A": 2,
  "UNDM CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE BOGIE D": 2,
  "UNDM CAR REMOVE/REFIT PARKING BRAKE DROP HOSE BOGIE D": 2,
  "UNDM - REMOVE/REFIT LINE CONTACTOR AIR SUPPLY": 2,
  "UNDM - WHEEL SPEED PROBE - MOTOR": 1,
  "UNDM CAR REMOVE/REFIT UNCOUPLER SWITCH UNDM": 2,
  "UNDM CAR REMOVE/REFIT PROPULSION INVERTER MODULE": 2,
  "UNDM CAR REMOVE/REFIT RHEOSTATIC BRAKE MODULE": 2,
  "UNDM CAR REMOVE/REFIT LINE FILTER CAPACITOR TRAY 6 CAP - KF": 2,
  "UNDM CAR REMOVE/REFIT LINE FILTER CAPACITOR TRAY 10 CAP": 2,
  "UNDM CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 1 (FOR ALL CARS)": 1,
  "UNDM CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 2 (FOR DM/UNDM)": 1,
  "UNDM CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (VLCV / SYSTEM DRAIN / WHISTLE)": 1,
  "UNDM CAR REMOVE/REFIT VARIABLE LOAD VALVE - UNDM CAR": 1,
  "UNDM CAR REMOVE/REFIT BRAKE RELEASE VALVE": 2,
  "UNDM CAR REMOVE/REFIT BRAKE CYLINDER SALOON GAUGES": 1,
  "UNDM CAR REMOVE/REFIT CLOSED LOOP ANALOGUE UNIT (CLAU) - UNDM CAR": 1,
  "UNDM CAR REMOVE/REFIT PNEUMATIC BRAKE DRIVER": 1,
  "UNDM CAR REMOVE/REFIT ¾\" GANGED VENTED COCKS (BCIC/PBIC)": 2,
  "UNDM CAR REMOVE/REFIT WSP DUMP VALVE - MOTOR": 1,
  "UNDM CAR REMOVE/REFIT WHISTLE - TYPE 3C (ENHANCED)": 1,
  "UNDM CAR REMOVE/REFIT WHISTLE CONTROL VALVE & BUTTON ASSY UNDM": 2,
  "UNDM CAR REMOVE/REFIT TRACTION SUPPLY PRESSURE REGULATOR": 1,
  "UNDM CAR REMOVE/REFIT DOOR AIR SUPPLY PRESSURE REGULATOR (SUPPLIED WITH O-RINGS)": 1,
  "UNDM CAR REMOVE/REFIT LOW MAIN LINE PRESSURE SWITCH": 1,
  "UNDM CAR REMOVE/REFIT COUPLING-TEST POINT-QUICK RELEASE": 1,
  "UNDM CAR REMOVE/REFIT MAINLINE CAB GAUGE": 1,
  "UNDM CAR REMOVE/REFIT PRESSURE GAUGE (DOOR/TRACTION SUPP)": 1,
  "UNDM CAR REMOVE/REFIT AIR FILTER WITH AUTOMATIC DRAIN": 1,
  "UNDM CAR REMOVE/REFIT BSR CHECK VALVE (SUPPLIED WITH O-RINGS)": 1,
  "UNDM CAR REMOVE/REFIT ½\" CHECK VALVE (SHOEGEAR AND LINEBREAKER AUX), SUPPLIED WITH O-RINGS": 1,
  "UNDM CAR REMOVE/REFIT ½\" CHECK VALVE (SHOEGEAR MANUAL CONTROL VALVE), SUPPLIED WITH O-RINGS": 1,
  "UNDM CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (FLANGE MOUNTED)": 1,
  "UNDM CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE A": 1,
  "UNDM CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE D": 1,
  "UNDM CAR REMOVE/REFIT RELAY PANEL 3": 1,
  "UNDM CAR REMOVE/REFIT CURRENT BALANCE DETECTOR RELAY (CBR)": 1,
  "UNDM -CAR REMOVE/REFIT RHEOSTATIC BRAKE RESISTOR FAN ASSEMBLY": 2,
  "UNDM -  CAR REMOVE/REFIT REVERSE VOLTAGE RELAY FUSE": 3,
  "UNDM -  CAR REMOVE/REFIT SHOE VOLTAGE RELAY FUSE 1 & 2 (SVRF 1 & 2)": 4,
  "UNDM CAR REMOVE/REFIT AUTOCOUPLER UNDM RH 3-CAR, DRAWGEAR, RADIAL SUPPORT BAR, CONTACT BOX ASSY L/H & CONTACT BOX ASSY R/H": 4,
  "UNDM CAR REMOVE/REFIT SEMI PERMANENT COUPLER BAR & DRAWGEAR INTERMEDIATE A": 4,
  "UNDM CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY UNDM": 2,
  "UNDM CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY INTERMEDIATE": 2,
  "UNDM CAR REMOVE/REFIT LINE CURRENT MONITORING DEVICE": 2,
  "UNDM CAR REMOVE/REFIT BRAKE SUPPLY RESERVOIR": 2,
  "UNDM CAR REMOVE/REFIT UNCOUPLER CYLINDER HOSE UNDM": 1,
  "UNDM CAR REMOVE/REFIT UNDM COUPLER HOSE & SEMI-PERM COUPLER HOSE": 2,
  "UNDM CAR REMOVE/REFIT 20 KHZ DISTRIBUTION PANEL": 1,
  "UNDM CAR REMOVE/REFIT POWER SUPPLY UNIT ISOLATION SWITCH": 1,
  "UNDM - CAR REMOVE/REFIT CAPACITOR PANEL ASSEMBLY": 2,
  "UNDM - SHED SUPPLY FUSE": 2,
  "UNDM - WIPER MOTOR": 2,
  "DM - CAR REMOVE/REFIT FILTER VOLTAGE MONITORING DEVICES VMD1, FVMD1": 1,
  "UNDM - REMOVE/REFIT SALOON MODULAR SEATING - CATCH PLATE, GAS STRUT, SEAL, PINS, SPACE COVER AND INSULATION BLANKET": 4,
  "UNDM  -  REMOVE/REFIT SALOON MODULAR SEATING - SEAT LOCK SPRING AND PIN SPRINGS": 2,
  "UNDM  REMOVE/REFIT TMRT - TRAIN MANAGEMENT REMOTE TERMINAL": 1,
  "UNDM CAR REMOVE/REFIT TMCC - TRAIN MANAGEMENT CAR CONTROLLER": 1,
  "UNDM CAR REMOVE/REFIT SALOON AUDIO VISUAL UNIT (SAVU)": 1,
  "UNDM -CAR REMOVE/REFIT SIGNAL RESISTOR PANEL": 1,
  "UNDM -CAR REMOVE/REFIT EQUIPMENT GOVERNOR": 2,
  "UNDM -  AUXILIARY ISOLATION CONTACTOR (AIC)": 2,
  "UNDM - CAR REMOVE/REFIT OUTPUT FILTER PANELS": 2,
  "UNDM - CHECK WHISTLE, CONTROL LEVER VALVE AND LOW MAINLINE PRESSURE SWITCH FITTINGS AND REPLACE ALL UNITS THAT HAVE THE UNAPPROVED PNEUMATIC BLUE SEAL FITTED WITH THE NORGREN SEALS": 2,
  "UNDM CAR REMOVE/REFIT AUTOCOUPLER UNDM RH 4-CAR, DRAWGEAR, RADIAL SUPPORT BAR, CONTACT BOX ASSY L/H & CONTACT BOX ASSY R/H": 4,
  "SPECIAL TRAILER  SALOON REMOVE/REFIT EMERGENCY LIGHT INVERTERS": 1,
  "SPECIAL TRAILER  SALOON REMOVE/REFIT MCBS": 1,
  "SPECIAL TRAILER SALOON REMOVE/REFIT MORS SMITT RELAYS": 1,
  "SPECIAL TRAILER CAR REMOVE BOGIE A": 4,
  "SPECIAL TRAILER CAR REFIT BOGIE A": 4,
  "SPECIAL TRAILER CAR REMOVE BOGIE D": 4,
  "SPECIAL TRAILER CAR REFIT BOGIE D": 4,
  "SPECIAL TRAILER CAR REMOVE/REFIT WSP CONTROL UNIT": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE BOGIE A": 2,
  "SPECIAL TRAILER CAR REMOVE/REFIT SERVICE BRAKE DROP HOSE BOGIE D": 2,
  "SPECIAL TRAILER - AXLE-END SPEED PROBE HOUSING (WSP)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 1 (FOR ALL CARS)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 2 (FOR TR CARS)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (VLCV / SYSTEM DRAIN / WHISTLE)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT VARIABLE LOAD VALVE - T/DIT CAR": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT BRAKE RELEASE VALVE": 2,
  "SPECIAL TRAILER CAR REMOVE/REFIT BRAKE CYLINDER SALOON GAUGES": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT CLOSED LOOP ANALOGUE UNIT (CLAU) - T/ DIT CAR": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT PNEUMATIC BRAKE DRIVER": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT ¾\" VENTED BALL VALVE (BCIC)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT WSP DUMP VALVE - TRAILER": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT DOOR AIR SUPPLY PRESSURE REGULATOR (SUPPLIED WITH O-RINGS)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT COUPLING-TEST POINT-QUICK RELEASE": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT PRESSURE GAUGE (DOOR/TRACTION SUPP)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT AIR FILTER WITH AUTOMATIC DRAIN": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT BSR CHECK VALVE (SUPPLIED WITH O-RINGS)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (FLANGE MOUNTED)": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE A": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT AIR FLOW CUT-OFF VALVE BOGIE D": 1,
  "SPECIAL TRAILER CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY INTERMEDIATE A END": 2,
  "SPECIAL TRAILER CAR REMOVE/REFIT ANTI-CLIMB BUFFER ASSEMBLY INTERMEDIATE D END": 2,
  "DO NOT FILL - DUPLICATE -SPECIAL TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE D END & SEMI-PERMANENT COUPLER BAR": 4,
  "DO NOT FILL - DUPLICATE - SPECIAL TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE A END & SEMI-PERMANENT COUPLER BAR": 4,
  "SPECIAL TRAILER CAR REMOVE/REFIT BRAKE SUPPLY RESERVOIR": 2,
  "SPECIAL TRAILER CAR REMOVE/REFIT UNDM & TC CARS COUPLER HOSES/SEMI-PERM HOSES": 2,
  "SPECIAL TRAILER - REMOVE/REFIT SALOON MODULAR SEATING - CATCH PLATE, GAS STRUT, SEAL, PINS, SPACE COVER AND INSULATION BLANKET": 4,
  "SPECIAL TRAILER - REMOVE/REFIT SALOON MODULAR SEATING - SEAT LOCK SPRING AND PIN SPRINGS": 2,
  "SPECIAL TRAILER CAR REMOVE/REFIT SALOON AUDIO VISUAL UNIT (SAVU)": 1,
  "TRAILER CAR REMOVE/REFIT 4 X TRAIN MANAGEMENT REMOTE TERMINALS.": 1,
  "TRAILER CAR REMOVE/REFIT BRAKE CYLINDER PRESSURE SWITCH 1 (FOR ALL CARS)": 1,
  "TRAILER CAR REMOVE/REFIT ½\u00a0VENTED BALL VALVE (VLCV / SYSTEM DRAIN / WHISTLE)": 1,
  "DO NOT FILL - DUPLICATE - TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE A END & SEMI-PERMANENT COUPLER BAR": 4,
  "TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE D END & SEMI-PERMANENT COUPLER BAR": 4,
  "TRAILER CAR REMOVE/REFIT BATTERY SUPPLY CAPACITORS (BSK 1, 2, 3)  NON ELECTROLYTIC CAPACITOR": 2,
  "TRAILER - REMOVE/REFIT BATTERY ISOLATION CONTACTORS N(C-BIC1 AND C-BIC 2)": 2,
  "TRAILER - REMOVE/REFIT SALOON MODULAR SEATING - CATCH PLATE, GAS STRUT, SEAL, PINS, SPACE COVER AND INSULATION BLANKET": 4,
  "TRAILER -  REMOVE/REFIT SALOON MODULAR SEATING - SEAT LOCK SPRING AND PIN SPRINGS": 2,
  "UNDM CAR REMOVE/REFIT CURRENT BALANCE RELAY PANEL": 1,
  "TRAILER - REPLACE DE-ICING HOSE POSITIVE (TO NOZZLE)": 2,
  "TRAILER - REPLACE DE-ICING HOSE NEGATIVE (TO NOZZLE)": 2,
  "TRAILER - REPLACE DE-ICING HOSE 1 FROM TANK": 2,
  "TRAILER - REPLACE DE-ICING HOSE 2 FROM TANK": 2,
  "TRAILER - REPLACE DE-ICING HOSE 3 FROM TANK": 2,
  "TRAILER - REPLACE - DE-ICING ANTI-VIBRATION MOUNTS": 2,
  "TRAILER - REPLACE DE-ICER TANK": 2,
  "DM CAR REMOVE/REFIT WHISTLE CONTROL LEVER VALVE (DM DRIVER'S SIDE)": 2,
  "DM - ASK CAPACITOR REPLACE": 2,
  "DM CAR REMOVE/REFIT WHISTLE CONTROL LEVER VALVE DM DRIVER'S SIDE)": 2,
  "DM - CAR REMOVE/REFIT MASTER CONTROL SWITCH (MSC)": 1,
  "DM CAR REMOVE/REFIT SEMI PERMANENT COUPLER BAR AND DRAWGEAR INTERMEDIATE D": 4,
  "TRAILER - WSP SPEED PROBE ASSEMBLY REPLACEMEND FOR NEW MODIFIED DESIGN BRACKET.": 1,
  "TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE A END & SEMI PERMANENT COUPLER BAR": 4,
  "SPECIAL TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE D END & SEMI-PERMANENT COUPLER BAR": 4,
  "SPECIAL TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE A END & SEMI-PERMANENT COUPLER BAR": 4,
  "TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE A END & SEMI-PERMANENT COUPLER BAR": 4,
  "DO NOT FILL - DUPLICATE  -TRAILER CAR REMOVE/REFIT DRAWGEAR INTERMEDIATE A END & SEMI PERMANENT COUPLER BAR": 4,
  "DM CAR REMOVE/REFIT WHISTLE CONTROL LEVER VALVE DM DRIVER'S SIDE.": 2,
  "DM CAR REMOVE/REFIT WHISTLE CONTROL LEVER VALVE DM INSTRUCTOR  SIDE": 1
}

// Helper function to get number of people for a task
const getTaskPeopleCount = (taskName) => {
  if (!taskName) return 1
  const upperName = taskName.toString().trim().toUpperCase()
  return TASK_PEOPLE_MAP[upperName] || 1
}

function EfficiencyDashboard() {
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState('')
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    overallEfficiency: 0
  })
  const [teamPerformance, setTeamPerformance] = useState([])
  const [unitProgress, setUnitProgress] = useState([])
  const [completionsByDay, setCompletionsByDay] = useState([])
  const [selectedTimeRange, setSelectedTimeRange] = useState('all')
  const [trains, setTrains] = useState([])
  const [selectedTrains, setSelectedTrains] = useState([]) // Array for multi-select
  const [lastClickedTrain, setLastClickedTrain] = useState(null) // For shift+click range selection
  const [sortBy, setSortBy] = useState('train') // 'train' or 'completion'
  const [showTeamRoster, setShowTeamRoster] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cacheTimestamp, setCacheTimestamp] = useState(null)
  const [cachedData, setCachedData] = useState(null)

  useEffect(() => {
    loadTrains()

    // Check for cached data in IndexedDB on initial load
    const initFromCache = async () => {
      try {
        const cached = await getCacheFromDB()
        console.log('IndexedDB cache check:', {
          hasCached: !!cached,
          cars: cached?.cars?.length || 0,
          completions: cached?.completions?.length || 0
        })

        if (cached?.cars?.length > 0 && cached?.completions?.length > 0) {
          setCachedData({ cars: cached.cars, completions: cached.completions })
          setCacheTimestamp(new Date(cached.timestamp))

          // Load dashboard with cached data immediately - NO server fetch
          console.log('Loading from IndexedDB cache - NO server fetch')
          loadDashboardDataWithCache({ cars: cached.cars, completions: cached.completions })
          return true
        }
      } catch (e) {
        console.error('Error reading IndexedDB cache:', e)
      }
      return false
    }

    initFromCache().then(hadCache => {
      if (!hadCache) {
        // No valid cache - must load from server
        console.log('No valid cache found, loading from server...')
        loadDashboardData(true)
      }
    })

    // Listen for refresh events from navbar
    const handleRefreshEvent = () => {
      handleRefresh()
    }
    window.addEventListener('refreshDashboardData', handleRefreshEvent)
    return () => window.removeEventListener('refreshDashboardData', handleRefreshEvent)
  }, [])

  useEffect(() => {
    // Only reload when filters change (not on initial mount)
    if (cachedData) {
      loadDashboardDataWithCache(cachedData)
    }
  }, [selectedTimeRange, selectedTrains])

  const loadTrains = async () => {
    try {
      const { data } = await supabase
        .from('train_units')
        .select('train_number, train_name')
        .order('train_number')

      if (data) {
        // Get unique trains
        const uniqueTrains = [...new Map(data.map(u => [u.train_number, u])).values()]
        setTrains(uniqueTrains)
      }
    } catch (error) {
      console.error('Error loading trains:', error)
    }
  }

  // Fetch all data with pagination (Supabase has 1000 row limit)
  const fetchAllData = async (table, select, filterFn = null) => {
    const allData = []
    const batchSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .range(offset, offset + batchSize - 1)

      if (error) {
        console.error(`Error fetching ${table}:`, error)
        break
      }

      if (data && data.length > 0) {
        allData.push(...data)
        offset += batchSize
        setLoadingProgress(`Loading ${table}: ${allData.length} records...`)
        hasMore = data.length === batchSize
      } else {
        hasMore = false
      }
    }

    return filterFn ? allData.filter(filterFn) : allData
  }

  // Process cached data without fetching from server
  const loadDashboardDataWithCache = (cache) => {
    setLoading(true)
    setLoadingProgress('Loading from cache...')

    try {
      const allCars = cache.cars || []
      const allCompletions = cache.completions || []

      // Filter cars by selected trains (multi-select)
      let filteredCarIds = []
      let filteredCars = allCars

      if (selectedTrains.length > 0) {
        // Filter by multiple selected trains
        filteredCars = allCars.filter(car => selectedTrains.includes(car.train_units?.train_number))
        filteredCarIds = filteredCars.map(c => c.id)
      } else {
        // No filter = all trains
        filteredCarIds = allCars.map(c => c.id)
      }

      // Filter completions by selected trains
      let completions = allCompletions
      if (selectedTrains.length > 0) {
        completions = allCompletions.filter(c => filteredCarIds.includes(c.car_id))
      }

      processCompletionsData(completions)
    } catch (error) {
      console.error('Error processing cached data:', error)
    }
    setLoading(false)
  }

  // Shared function to process completions data
  const processCompletionsData = (completions) => {
    if (!completions) return

    // Calculate stats from actual task_completions data
    const totalTasks = completions.length
    const completed = completions.filter(c => c.status === 'completed').length
    const inProgress = completions.filter(c => c.status === 'in_progress').length
    const pending = completions.filter(c => c.status === 'pending').length

    setStats({
      totalTasks,
      completedTasks: completed,
      inProgressTasks: inProgress,
      pendingTasks: pending,
      overallEfficiency: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0
    })

    // Calculate team performance with person-days tracking
    // Efficiency = task_hours / (8h × person-days)
    // Where person-days = unique (person, date) combinations
    const teamStats = {}
    const personDaysTracker = {} // { teamKey: Set of "person|date" strings }

    completions.forEach(c => {
      let teamKey = null
      let teamName = null
      let teamColor = null

      if (c.teams) {
        // Has a team assigned in database
        teamKey = c.teams.id
        // Rename "Night Shift" to "Team D"
        teamName = c.teams.name === 'Night Shift' ? 'Team D' : c.teams.name
        teamColor = c.teams.color
      } else if (c.completed_by) {
        // No team assigned - check if TFOS is in completed_by
        const completedByArr = Array.isArray(c.completed_by) ? c.completed_by : [c.completed_by]
        const hasTFOS = completedByArr.some(name =>
          name && name.toString().toUpperCase().includes('TFOS')
        )
        if (hasTFOS) {
          teamKey = 'TFOS'
          teamName = 'TFOS'
          teamColor = '#EF4444' // Red color for TFOS
        }
      }

      if (teamKey) {
        if (!teamStats[teamKey]) {
          teamStats[teamKey] = {
            name: teamName,
            color: teamColor,
            completed: 0,
            inProgress: 0,
            total: 0,
            totalMinutes: 0,
            completedMinutes: 0
          }
          personDaysTracker[teamKey] = new Set()
        }
        teamStats[teamKey].total++
        const taskMinutes = c.total_minutes || 0
        // Multiply by number of people required for this task
        // A 7-hour job with 2 people = 14 man-hours of work
        const numPeople = getTaskPeopleCount(c.task_name)
        const adjustedMinutes = taskMinutes * numPeople
        teamStats[teamKey].totalMinutes += adjustedMinutes

        if (c.status === 'completed') {
          teamStats[teamKey].completed++
          teamStats[teamKey].completedMinutes += adjustedMinutes

          // Track person-days for efficiency calculation
          // Each unique (person, date) combination = 8 hours available
          if (c.completed_at && c.completed_by) {
            const dateStr = c.completed_at.split('T')[0]
            const completedByArr = Array.isArray(c.completed_by) ? c.completed_by : [c.completed_by]
            completedByArr.forEach(person => {
              if (person) {
                const personDay = `${person.toString().trim().toUpperCase()}|${dateStr}`
                personDaysTracker[teamKey].add(personDay)
              }
            })
          }
        }
        if (c.status === 'in_progress') teamStats[teamKey].inProgress++
      }
    })

    // Sort by number of completed tasks (descending) for ranking
    // Calculate efficiency: task_hours / (8h × person-days)
    // Exclude TFOS from efficiency ranking - it's a location, not a team
    const teamData = Object.entries(teamStats)
      .filter(([teamKey, team]) => team.name !== 'TFOS') // Exclude TFOS
      .map(([teamKey, team]) => {
        const personDays = personDaysTracker[teamKey]?.size || 0
        const availableHours = personDays * 8
        const taskHours = team.completedMinutes / 60
        // Real efficiency = work hours / available hours (8h per person per day)
        const realEfficiency = availableHours > 0 ? Math.round((taskHours / availableHours) * 100) : 0

        return {
          ...team,
          personDays,
          availableHours: Math.round(availableHours * 10) / 10,
          efficiency: team.total > 0 ? Math.round((team.completed / team.total) * 100) : 0, // Task completion %
          totalHours: Math.round(team.totalMinutes / 60 * 10) / 10, // 1 decimal
          completedHours: Math.round(team.completedMinutes / 60 * 10) / 10,
          timeEfficiency: realEfficiency // Real efficiency based on 8h/person/day
        }
      }).sort((a, b) => b.completed - a.completed)

    setTeamPerformance(teamData)

    // Calculate train progress (aggregate by train number T01-T62)
    const trainStats = {}
    completions.forEach(c => {
      const trainNumber = c.cars?.train_units?.train_number
      if (trainNumber) {
        const trainKey = `T${String(trainNumber).padStart(2, '0')}`
        if (!trainStats[trainKey]) {
          trainStats[trainKey] = {
            name: trainKey,
            trainNumber,
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0
          }
        }
        trainStats[trainKey].totalTasks++
        if (c.status === 'completed') {
          trainStats[trainKey].completedTasks++
        } else if (c.status === 'in_progress') {
          trainStats[trainKey].inProgressTasks++
        }
      }
    })

    const trainData = Object.values(trainStats).map(train => ({
      ...train,
      percent: train.totalTasks > 0 ? Math.round((train.completedTasks / train.totalTasks) * 100) : 0
    }))

    setUnitProgress(trainData)

    // Calculate completions by day (from actual data, not just last 14 days)
    const dailyStats = {}
    const now = new Date()
    const maxValidYear = now.getFullYear() + 1 // Allow up to next year
    const minValidYear = 2020 // No dates before 2020

    completions.forEach(c => {
      if (c.completed_at) {
        const dateStr = c.completed_at.split('T')[0]
        // Validate date - must be a valid format YYYY-MM-DD
        if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Additional validation: check year is reasonable
          const year = parseInt(dateStr.substring(0, 4))
          if (year >= minValidYear && year <= maxValidYear) {
            if (!dailyStats[dateStr]) {
              dailyStats[dateStr] = { date: dateStr, count: 0 }
            }
            dailyStats[dateStr].count++
          }
        }
      }
    })

    // Sort by actual date (not string comparison) and take last 30 entries
    const sortedDays = Object.values(dailyStats)
      .map(d => ({
        ...d,
        dateObj: new Date(d.date + 'T00:00:00'), // Parse as local time
        displayDate: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      }))
      .filter(d => !isNaN(d.dateObj.getTime())) // Filter out invalid dates
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()) // Sort by timestamp
      .slice(-30)

    setCompletionsByDay(sortedDays)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setCachedData(null)
    await clearCacheFromDB()
    loadDashboardData(true)
  }

  const loadDashboardData = async (forceRefresh = false) => {
    setLoading(true)
    setLoadingProgress('Starting data load...')
    try {
      // Get all cars with their train unit info (with pagination)
      setLoadingProgress('Loading cars from server...')
      const allCars = await fetchAllData('cars', '*, train_units(*), car_types(*)')

      // Get all completions with pagination
      setLoadingProgress('Loading task completions from server...')
      const allCompletions = await fetchAllData('task_completions', `
        *,
        teams(*),
        cars(*, train_units(*), car_types(*))
      `)

      // Cache the data to IndexedDB (no size limit like localStorage)
      try {
        await saveCacheToDB(allCars, allCompletions)
        // Store in state for filter changes
        setCachedData({ cars: allCars, completions: allCompletions })
        setCacheTimestamp(new Date())
      } catch (e) {
        console.error('Could not cache data to IndexedDB:', e)
      }

      // Filter cars by selected trains (multi-select)
      let filteredCarIds = []
      let filteredCars = allCars || []

      if (selectedTrains.length > 0 && allCars) {
        filteredCars = allCars.filter(car => selectedTrains.includes(car.train_units?.train_number))
        filteredCarIds = filteredCars.map(c => c.id)
      } else if (allCars) {
        filteredCarIds = allCars.map(c => c.id)
      }

      // Filter completions by selected trains
      let completions = allCompletions || []
      if (selectedTrains.length > 0 && allCompletions) {
        completions = allCompletions.filter(c => filteredCarIds.includes(c.car_id))
      }

      setLoadingProgress('Processing data...')
      processCompletionsData(completions)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
    setLoading(false)
    setIsRefreshing(false)
  }

  const COLORS = ['#10B981', '#F59E0B', '#94a3b8']

  // Handle train button click with shift and ctrl/cmd modifiers
  const handleTrainClick = (trainNumber, event) => {
    const isShiftClick = event.shiftKey
    const isCtrlClick = event.ctrlKey || event.metaKey

    if (isShiftClick && lastClickedTrain !== null) {
      // Shift+click: select range from last clicked to current
      const allTrainNumbers = trains.map(t => t.train_number).sort((a, b) => a - b)
      const startIdx = allTrainNumbers.indexOf(lastClickedTrain)
      const endIdx = allTrainNumbers.indexOf(trainNumber)
      const [minIdx, maxIdx] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)]
      const rangeTrains = allTrainNumbers.slice(minIdx, maxIdx + 1)

      // Add range to existing selection (union)
      const newSelection = [...new Set([...selectedTrains, ...rangeTrains])]
      setSelectedTrains(newSelection)
    } else if (isCtrlClick) {
      // Ctrl/Cmd+click: toggle single train
      if (selectedTrains.includes(trainNumber)) {
        setSelectedTrains(selectedTrains.filter(t => t !== trainNumber))
      } else {
        setSelectedTrains([...selectedTrains, trainNumber])
      }
    } else {
      // Regular click: toggle single train (or select if none selected)
      if (selectedTrains.includes(trainNumber) && selectedTrains.length === 1) {
        // Clicking the only selected train - deselect it (show all)
        setSelectedTrains([])
      } else if (selectedTrains.includes(trainNumber)) {
        // Clicking a selected train with multiple selected - narrow to just this one
        setSelectedTrains([trainNumber])
      } else {
        // Clicking an unselected train - select only this one
        setSelectedTrains([trainNumber])
      }
    }
    setLastClickedTrain(trainNumber)
  }

  const pieData = [
    { name: 'Completed', value: stats.completedTasks, color: '#10B981' },
    { name: 'In Progress', value: stats.inProgressTasks, color: '#F59E0B' },
    { name: 'Pending', value: stats.pendingTasks, color: '#94a3b8' }
  ].filter(d => d.value > 0)

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <div>Loading dashboard...</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {loadingProgress}
          </div>
        </div>
      </div>
    )
  }

  // Sort train progress data
  const sortedUnitProgress = [...unitProgress].sort((a, b) => {
    if (sortBy === 'completion') {
      return b.percent - a.percent // High to low completion
    }
    return a.trainNumber - b.trainNumber // T01 to T62
  })

  return (
    <div className="efficiency-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Efficiency Dashboard</h1>
          {cacheTimestamp && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Data cached: {cacheTimestamp.toLocaleString()}
            </div>
          )}
        </div>

        {/* Train Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Filter size={20} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {selectedTrains.length === 0
              ? 'All Trains'
              : `${selectedTrains.length} train${selectedTrains.length > 1 ? 's' : ''} selected`}
          </span>
          {selectedTrains.length > 0 && (
            <button
              onClick={() => setSelectedTrains([])}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Multi-Train Selection Grid */}
      <div className="chart-container" style={{ marginBottom: '1.5rem' }}>
        <div className="chart-header" style={{ marginBottom: '0.75rem' }}>
          <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} />
            Select Trains
            <span style={{ fontWeight: 'normal', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              (Click to select, Shift+click for range, Ctrl+click to add/remove)
            </span>
          </h3>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
          gap: '0.375rem',
          maxHeight: '150px',
          overflowY: 'auto',
          padding: '0.5rem'
        }}>
          {trains.map(train => {
            const isSelected = selectedTrains.includes(train.train_number)
            return (
              <button
                key={train.train_number}
                onClick={(e) => handleTrainClick(train.train_number, e)}
                style={{
                  padding: '0.375rem 0.5rem',
                  borderRadius: '0.375rem',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--primary)' : 'var(--bg)',
                  color: isSelected ? 'white' : 'var(--text)',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                T{String(train.train_number).padStart(2, '0')}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter indicator */}
      {selectedTrains.length > 0 && (
        <div style={{
          background: 'var(--accent)',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          flexWrap: 'wrap'
        }}>
          <span>Showing data for:</span>
          {selectedTrains.sort((a, b) => a - b).map(t => (
            <span key={t} style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem'
            }}>
              T{String(t).padStart(2, '0')}
            </span>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-label">Overall Efficiency</div>
              <div className="stat-value">{stats.overallEfficiency}%</div>
            </div>
            <div className="stat-icon green">
              <Target size={24} />
            </div>
          </div>
          <div className="progress-bar" style={{ height: '8px', marginTop: '0.5rem' }}>
            <div
              className="progress-fill"
              style={{ width: `${stats.overallEfficiency}%`, background: '#10B981' }}
            />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-label">Tasks Completed</div>
              <div className="stat-value">{stats.completedTasks}</div>
            </div>
            <div className="stat-icon green">
              <CheckCircle size={24} />
            </div>
          </div>
          <div className="stat-change">of {stats.totalTasks} total tasks</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-label">In Progress</div>
              <div className="stat-value">{stats.inProgressTasks}</div>
            </div>
            <div className="stat-icon orange">
              <Clock size={24} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-label">Teams Active</div>
              <div className="stat-value">{teamPerformance.length}</div>
            </div>
            <div className="stat-icon purple">
              <Users size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Daily Completions Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">
              Completion History {completionsByDay.length > 0 && `(${completionsByDay.length} days with activity)`}
            </h3>
          </div>
          {completionsByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={completionsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [`${value} tasks`, 'Completed']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <p>No completion dates recorded in the data.</p>
              <p style={{ fontSize: '0.875rem' }}>Tasks marked as completed do not have recorded completion timestamps.</p>
            </div>
          )}
        </div>

        {/* Task Status Pie Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Task Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Train Progress */}
      <div className="chart-container">
        <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 className="chart-title">
            {selectedTrains.length === 0
              ? `Progress by Train (${unitProgress.length} trains)`
              : selectedTrains.length === 1
                ? `Progress - T${String(selectedTrains[0]).padStart(2, '0')}`
                : `Progress - ${selectedTrains.length} Selected Trains`}
          </h3>
          {selectedTrains.length === 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setSortBy('train')}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border)',
                  background: sortBy === 'train' ? 'var(--accent)' : 'transparent',
                  color: sortBy === 'train' ? 'white' : 'var(--text)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <ArrowUpDown size={12} /> By Train (T01-T62)
              </button>
              <button
                onClick={() => setSortBy('completion')}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border)',
                  background: sortBy === 'completion' ? 'var(--accent)' : 'transparent',
                  color: sortBy === 'completion' ? 'white' : 'var(--text)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <ArrowUpDown size={12} /> By Completion %
              </button>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={selectedTrains.length === 0 ? Math.max(800, sortedUnitProgress.length * 25) : Math.max(300, sortedUnitProgress.length * 30)}>
          <BarChart data={sortedUnitProgress} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={60} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px'
              }}
              formatter={(value, name, props) => {
                const item = props.payload
                return [`${value}% (${item.completedTasks}/${item.totalTasks} tasks)`, 'Completion']
              }}
            />
            <Bar dataKey="percent" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Team Roster */}
      <div className="chart-container" style={{ marginTop: '1.5rem' }}>
        <div
          className="chart-header"
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => setShowTeamRoster(!showTeamRoster)}
        >
          <h3 className="chart-title">
            <Users size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Team Roster (Click to {showTeamRoster ? 'hide' : 'show'})
          </h3>
          {showTeamRoster ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {showTeamRoster && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem 0' }}>
            {Object.entries(TEAM_ROSTER).map(([teamName, members]) => (
              <div key={teamName} style={{
                background: 'var(--bg)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)'
              }}>
                <h4 style={{
                  marginBottom: '0.75rem',
                  color: teamName === 'Team A' ? '#3B82F6' :
                         teamName === 'Team B' ? '#10B981' :
                         teamName === 'Team C' ? '#F59E0B' :
                         teamName === 'Team D' ? '#8B5CF6' :
                         teamName === 'TFOS' ? '#EF4444' : '#94a3b8',
                  fontWeight: '600'
                }}>
                  {teamName}
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {members.map(member => (
                    <span key={member} style={{
                      background: 'var(--bg-card)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem'
                    }}>
                      {member}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Performance Table */}
      <div className="chart-container" style={{ marginTop: '1.5rem' }}>
        <div className="chart-header">
          <h3 className="chart-title">
            <Award size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Team Performance Ranking
          </h3>
        </div>
        <table className="performance-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Tasks Done</th>
              <th>Task Hours</th>
              <th>Person-Days</th>
              <th>Avail. Hours</th>
              <th className="progress-cell">Task %</th>
              <th className="progress-cell">Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {teamPerformance.map((team, idx) => (
              <tr key={team.name}>
                <td>
                  {idx === 0 && <Award size={16} style={{ color: '#F59E0B' }} />}
                  {idx === 1 && <Award size={16} style={{ color: '#94a3b8' }} />}
                  {idx === 2 && <Award size={16} style={{ color: '#CD7F32' }} />}
                  {idx > 2 && (idx + 1)}
                </td>
                <td>
                  <span className="team-badge">
                    <span className="team-color" style={{ backgroundColor: team.color }} />
                    {team.name}
                  </span>
                </td>
                <td>{team.completed}/{team.total}</td>
                <td>{team.completedHours}h</td>
                <td>{team.personDays}</td>
                <td>{team.availableHours}h</td>
                <td className="progress-cell">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="progress-bar" style={{ flex: 1, minWidth: '60px' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${team.efficiency}%`,
                          background: team.efficiency >= 80 ? '#10B981' :
                                     team.efficiency >= 50 ? '#F59E0B' : '#EF4444'
                        }}
                      />
                    </div>
                    <span style={{ minWidth: '35px', textAlign: 'right', fontSize: '0.8rem' }}>{team.efficiency}%</span>
                  </div>
                </td>
                <td className="progress-cell">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="progress-bar" style={{ flex: 1, minWidth: '60px' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(team.timeEfficiency, 100)}%`,
                          background: team.timeEfficiency >= 80 ? '#10B981' :
                                     team.timeEfficiency >= 50 ? '#F59E0B' : '#EF4444'
                        }}
                      />
                    </div>
                    <span style={{ minWidth: '35px', textAlign: 'right', fontSize: '0.8rem' }}>{team.timeEfficiency}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {teamPerformance.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8' }}>
                  No team data available. Complete tasks and assign teams to see performance metrics.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <strong>Efficiency Formula:</strong> (Task Hours × Number of People) ÷ Available Hours (8h × Person-Days)
          <br />
          <em>Example: A 7h task requiring 2 people = 14 man-hours. If AS works 3 days on such tasks, efficiency = 14h ÷ (8h × 3) = 58.3%</em>
          <br />
          <em style={{ color: 'var(--accent)' }}>Note: Task hours are multiplied by number of operators required (from Excel column M) for accurate man-hour calculations.</em>
        </div>
      </div>

      {/* Finance Justification Section */}
      <div className="chart-container" style={{ marginTop: '1.5rem' }}>
        <div className="chart-header">
          <h3 className="chart-title">
            <TrendingUp size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Business Metrics Summary
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem 0' }}>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Total Tasks Tracked
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{stats.totalTasks}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Work Completion Rate
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stats.overallEfficiency >= 80 ? '#10B981' : '#F59E0B' }}>
              {stats.overallEfficiency}%
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Active Work Units
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{unitProgress.length}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Tasks Remaining
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#EF4444' }}>
              {stats.pendingTasks + stats.inProgressTasks}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EfficiencyDashboard
