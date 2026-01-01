import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Check, Clock, Circle, X, Train, AlertCircle, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import * as XLSX from 'xlsx'

function TaskTracker() {
  const [trains, setTrains] = useState([]) // Grouped by train_name
  const [selectedTrains, setSelectedTrains] = useState([]) // Support multiple trains
  const [viewAllTrains, setViewAllTrains] = useState(false) // Toggle to view all trains
  const [lastClickedTrain, setLastClickedTrain] = useState(null) // For shift+click range selection
  const [cars, setCars] = useState([])
  const [teams, setTeams] = useState([])
  const [carTypes, setCarTypes] = useState([])
  const [taskCompletions, setTaskCompletions] = useState([])
  const [selectedCar, setSelectedCar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({
    status: 'completed',
    team_id: '',
    completed_by: '',
    notes: ''
  })
  const fileInputRef = useRef(null)

  // Filter states
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [taskTextFilter, setTaskTextFilter] = useState('') // Text/regex filter for tasks
  const [isTaskListCollapsed, setIsTaskListCollapsed] = useState(false)
  const [collapsedPhases, setCollapsedPhases] = useState({}) // Track which phases are collapsed
  const [isTrainSelectorCollapsed, setIsTrainSelectorCollapsed] = useState(false)
  const [isCarVisualCollapsed, setIsCarVisualCollapsed] = useState(false)
  const [viewAllCars, setViewAllCars] = useState(false) // View tasks from all cars
  const [trainCompletionData, setTrainCompletionData] = useState({}) // Cache train completion stats

  // Backward compatibility helper - get first selected train
  const selectedTrain = selectedTrains.length > 0 ? selectedTrains[0] : null

  // Aggregate cars by car type when multiple trains are selected
  // This creates 7 "virtual" cars combining tasks from all trains
  const getAggregatedCars = () => {
    if (selectedTrains.length <= 1 && !viewAllTrains) {
      return cars // Return individual cars for single train
    }

    // Define car type order and display names
    const carTypeConfig = [
      { name: 'DM 3 CAR', display: 'DM', category: '3 CAR' },
      { name: 'Trailer 3 Car', display: 'Trailer', category: '3 CAR' },
      { name: 'UNDM 3 CAR', display: 'UNDM', category: '3 CAR' },
      { name: 'DM 4 Car', display: 'DM', category: '4 CAR' },
      { name: 'Trailer 4 Car', display: 'Trailer', category: '4 CAR' },
      { name: 'Special Trailer 4 Car', display: 'Special Trailer', category: '4 CAR' },
      { name: 'UNDM 4 Car', display: 'UNDM', category: '4 CAR' }
    ]

    // Group cars by type
    const carsByType = {}
    cars.forEach(car => {
      const typeName = car.car_types?.name
      if (!carsByType[typeName]) {
        carsByType[typeName] = []
      }
      carsByType[typeName].push(car)
    })

    // Create aggregated cars
    return carTypeConfig.map((config, idx) => {
      const carsOfType = carsByType[config.name] || []
      const allCompletions = carsOfType.flatMap(c => c.task_completions || [])
      const trainNumbers = [...new Set(carsOfType.map(c => c.trainNumber))].sort((a, b) => a - b)

      return {
        id: `aggregated-${config.name}`,
        isAggregated: true,
        car_types: { name: config.name, category: config.category },
        displayName: config.display,
        car_number: trainNumbers.length > 1
          ? `${trainNumbers.length} trains`
          : carsOfType[0]?.car_number || '',
        task_completions: allCompletions,
        sourceCars: carsOfType, // Keep reference to original cars
        trainNumbers: trainNumbers
      }
    })
  }

  // Get the cars to display (aggregated or individual)
  const displayCars = getAggregatedCars()

  // Get unique phases from current car's tasks
  const getUniquePhases = (tasks) => {
    const phases = [...new Set(tasks.map(t => t.phase || 'No Phase').filter(Boolean))]
    // Sort phases: Phase 0, Phase 1, etc., then Catchback, then No Phase
    return phases.sort((a, b) => {
      const getOrder = (p) => {
        if (p === 'No Phase') return 999
        if (p.toLowerCase().includes('catchback')) return 998
        const match = p.match(/Phase\s*(\d+\.?\d*)/i)
        if (match) return parseFloat(match[1])
        return 500
      }
      return getOrder(a) - getOrder(b)
    })
  }

  // Group tasks by phase
  const groupTasksByPhase = (tasks) => {
    const grouped = {}
    tasks.forEach(task => {
      const phase = task.phase || 'No Phase'
      if (!grouped[phase]) grouped[phase] = []
      grouped[phase].push(task)
    })
    return grouped
  }

  // Toggle phase collapse
  const togglePhaseCollapse = (phase) => {
    setCollapsedPhases(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }))
  }

  // Collapse/expand all phases
  const toggleAllPhases = (collapsed) => {
    const allPhases = selectedCar?.task_completions ? getUniquePhases(selectedCar.task_completions) : []
    const newState = {}
    allPhases.forEach(phase => {
      newState[phase] = collapsed
    })
    setCollapsedPhases(newState)
  }

  useEffect(() => {
    loadData()

    // Listen for upload trigger from navbar
    const handleUploadTrigger = () => {
      fileInputRef.current?.click()
    }
    window.addEventListener('triggerExcelUpload', handleUploadTrigger)
    return () => window.removeEventListener('triggerExcelUpload', handleUploadTrigger)
  }, [])

  useEffect(() => {
    if (viewAllTrains && trains.length > 0) {
      loadCarsForMultipleTrains(trains)
    } else if (selectedTrains.length > 0) {
      loadCarsForMultipleTrains(selectedTrains)
    }
  }, [selectedTrains, viewAllTrains, statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [unitsRes, teamsRes, carTypesRes] = await Promise.all([
        supabase.from('train_units').select('*').eq('is_active', true).order('unit_number'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('car_types').select('*').order('name')
      ])

      if (teamsRes.data) setTeams(teamsRes.data)
      if (carTypesRes.data) setCarTypes(carTypesRes.data)

      // Group units by train_name to form complete trains
      if (unitsRes.data) {
        const trainGroups = {}
        unitsRes.data.forEach(unit => {
          const trainName = unit.train_name || unit.unit_number
          if (!trainGroups[trainName]) {
            trainGroups[trainName] = {
              name: trainName,
              trainNumber: unit.train_number,
              phase: unit.phase,
              units: []
            }
          }
          trainGroups[trainName].units.push(unit)
        })
        // Sort by train_number if available
        const trainList = Object.values(trainGroups).sort((a, b) => {
          if (a.trainNumber && b.trainNumber) return a.trainNumber - b.trainNumber
          return a.name.localeCompare(b.name)
        })
        setTrains(trainList)

        if (trainList.length > 0) {
          setSelectedTrains([trainList[0]])
          setLastClickedTrain(trainList[0])
        }

        // Load completion stats for all trains
        loadTrainCompletionStats(trainList)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }

  // Load completion stats for all trains (for showing % on buttons)
  const loadTrainCompletionStats = async (trainList) => {
    try {
      // Get all unit IDs
      const allUnitIds = trainList.flatMap(t => t.units.map(u => u.id))

      // Fetch all cars with task completions for all trains
      const { data: allCars } = await supabase
        .from('cars')
        .select('unit_id, task_completions(status)')
        .in('unit_id', allUnitIds)

      if (allCars) {
        const stats = {}
        trainList.forEach(train => {
          const trainUnitIds = train.units.map(u => u.id)
          const trainCars = allCars.filter(c => trainUnitIds.includes(c.unit_id))
          const allTasks = trainCars.flatMap(c => c.task_completions || [])

          const total = allTasks.length
          const completed = allTasks.filter(t => t.status === 'completed').length
          const inProgress = allTasks.filter(t => t.status === 'in_progress').length
          const pending = allTasks.filter(t => t.status === 'pending').length

          stats[train.name] = {
            total,
            completed,
            inProgress,
            pending,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0
          }
        })
        setTrainCompletionData(stats)
      }
    } catch (error) {
      console.error('Error loading train completion stats:', error)
    }
  }

  const loadCarsForTrain = async (train) => {
    try {
      // Get all unit IDs for this train
      const unitIds = train.units.map(u => u.id)

      const { data: carsData } = await supabase
        .from('cars')
        .select('*, car_types(*), train_units(*), task_completions(*, teams(*))')
        .in('unit_id', unitIds)

      if (carsData) {
        // Sort cars by category (3 CAR first, then 4 CAR) and then by type name
        const sortOrder = {
          'DM 3 CAR': 1,
          'Trailer 3 Car': 2,
          'UNDM 3 CAR': 3,
          'DM 4 Car': 4,
          'Trailer 4 Car': 5,
          'Special Trailer 4 Car': 6,
          'UNDM 4 Car': 7
        }

        const sortedCars = carsData.sort((a, b) => {
          const orderA = sortOrder[a.car_types?.name] || 99
          const orderB = sortOrder[b.car_types?.name] || 99
          return orderA - orderB
        })

        setCars(sortedCars)
        // Flatten all completions
        const allCompletions = sortedCars.flatMap(c => c.task_completions || [])
        setTaskCompletions(allCompletions)

        // Auto-select car based on current filter
        if (sortedCars.length > 0) {
          // If there's a status filter, find the first car with matching tasks
          if (statusFilter !== 'all') {
            const carWithMatchingTasks = sortedCars.find(car =>
              car.task_completions?.some(t => t.status === statusFilter)
            )
            if (carWithMatchingTasks) {
              setSelectedCar(carWithMatchingTasks)
            } else {
              // No car has matching tasks, select first car anyway
              setSelectedCar(sortedCars[0])
            }
          } else {
            // No filter, select first car
            setSelectedCar(sortedCars[0])
          }
        }
      }
    } catch (error) {
      console.error('Error loading cars:', error)
    }
  }

  // Load cars for multiple trains (for multi-select or All Trains mode)
  // Batches requests to avoid URL length limits (500 error)
  const loadCarsForMultipleTrains = async (trainList) => {
    try {
      // Get all unit IDs for all selected trains
      const allUnitIds = trainList.flatMap(t => t.units.map(u => u.id))

      // Batch requests to avoid URL length limits (max ~50 IDs per request)
      const BATCH_SIZE = 50
      const batches = []
      for (let i = 0; i < allUnitIds.length; i += BATCH_SIZE) {
        batches.push(allUnitIds.slice(i, i + BATCH_SIZE))
      }

      // Fetch all batches in parallel
      const batchResults = await Promise.all(
        batches.map(batchIds =>
          supabase
            .from('cars')
            .select('*, car_types(*), train_units(*), task_completions(*, teams(*))')
            .in('unit_id', batchIds)
        )
      )

      // Combine results
      const carsData = batchResults.flatMap(result => result.data || [])

      if (carsData) {
        // Add train info to each car for display
        const carsWithTrainInfo = carsData.map(car => {
          const train = trainList.find(t => t.units.some(u => u.id === car.unit_id))
          return {
            ...car,
            trainNumber: train?.trainNumber,
            trainName: train?.name
          }
        })

        // Sort cars by train number first, then by car type
        const sortOrder = {
          'DM 3 CAR': 1,
          'Trailer 3 Car': 2,
          'UNDM 3 CAR': 3,
          'DM 4 Car': 4,
          'Trailer 4 Car': 5,
          'Special Trailer 4 Car': 6,
          'UNDM 4 Car': 7
        }

        const sortedCars = carsWithTrainInfo.sort((a, b) => {
          // Sort by train number first
          if (a.trainNumber !== b.trainNumber) {
            return (a.trainNumber || 0) - (b.trainNumber || 0)
          }
          // Then by car type
          const orderA = sortOrder[a.car_types?.name] || 99
          const orderB = sortOrder[b.car_types?.name] || 99
          return orderA - orderB
        })

        setCars(sortedCars)
        // Flatten all completions
        const allCompletions = sortedCars.flatMap(c => c.task_completions || [])
        setTaskCompletions(allCompletions)

        // Auto-select car based on current filter
        if (sortedCars.length > 0) {
          if (statusFilter !== 'all') {
            const carWithMatchingTasks = sortedCars.find(car =>
              car.task_completions?.some(t => t.status === statusFilter)
            )
            if (carWithMatchingTasks) {
              setSelectedCar(carWithMatchingTasks)
            } else {
              setSelectedCar(sortedCars[0])
            }
          } else {
            setSelectedCar(sortedCars[0])
          }
        }
      }
    } catch (error) {
      console.error('Error loading cars for multiple trains:', error)
    }
  }

  // Get filtered trains based on status filter
  const getFilteredTrains = () => {
    return trains.filter(train => {
      const stats = trainCompletionData[train.name]
      if (statusFilter === 'in_progress') return stats?.inProgress > 0
      if (statusFilter === 'pending') return stats?.pending > 0
      if (statusFilter === 'completed') return stats?.completed > 0
      return true
    })
  }

  // Handle train click with shift for multi-select
  const handleTrainClick = (train, event, filteredTrainsList) => {
    if (event.shiftKey && lastClickedTrain) {
      // Shift+click: select range of trains from filtered list
      const startIdx = filteredTrainsList.findIndex(t => t.name === lastClickedTrain.name)
      const endIdx = filteredTrainsList.findIndex(t => t.name === train.name)
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
        const rangeTrains = filteredTrainsList.slice(from, to + 1)
        setSelectedTrains(rangeTrains)
      } else {
        // Fallback if last clicked train not in filtered list
        setSelectedTrains([train])
      }
      setViewAllTrains(false)
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click: toggle single train in selection
      setSelectedTrains(prev => {
        const isSelected = prev.some(t => t.name === train.name)
        if (isSelected) {
          return prev.filter(t => t.name !== train.name)
        } else {
          return [...prev, train]
        }
      })
      setViewAllTrains(false)
    } else {
      // Regular click: select single train
      setSelectedTrains([train])
      setViewAllTrains(false)
    }
    setLastClickedTrain(train)
    setSelectedCar(null)
  }

  const getCarProgress = (car) => {
    const completions = car.task_completions || []
    const completed = completions.filter(c => c.status === 'completed').length
    const total = completions.length
    return {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }

  // Distinct color steps from red (0%) to green (100%)
  const getCarColor = (percent) => {
    if (percent === 100) return '#10B981' // Green - complete
    if (percent >= 90) return '#22C55E'   // Light green
    if (percent >= 80) return '#84CC16'   // Lime
    if (percent >= 70) return '#A3E635'   // Yellow-lime
    if (percent >= 60) return '#FACC15'   // Yellow
    if (percent >= 50) return '#FCD34D'   // Light yellow
    if (percent >= 40) return '#FBBF24'   // Amber
    if (percent >= 30) return '#F59E0B'   // Orange
    if (percent >= 20) return '#FB923C'   // Light orange
    if (percent >= 10) return '#F97316'   // Dark orange
    if (percent > 0) return '#EF4444'     // Red
    return '#475569'                      // Gray - no progress
  }

  const openTaskModal = (task) => {
    setSelectedTask(task)
    setFormData({
      status: task.status || 'completed',
      team_id: task.team_id || '',
      completed_by: task.completed_by?.join(', ') || '',
      notes: task.notes || ''
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTask) return

    const initialsArray = formData.completed_by
      .split(/[,\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0)

    const payload = {
      status: formData.status,
      team_id: formData.team_id || null,
      completed_by: initialsArray,
      notes: formData.notes,
      completed_at: formData.status === 'completed' ? new Date().toISOString() : null
    }

    try {
      await supabase
        .from('task_completions')
        .update(payload)
        .eq('id', selectedTask.id)

      await loadCarsForTrain(selectedTrain)
      setModalOpen(false)
    } catch (error) {
      console.error('Error saving completion:', error)
    }
  }

  // Extract train number from filename (e.g., "WorktosheetsV3 T33 - (Units 96021 & 96094).xlsm")
  const extractTrainNumber = (filename) => {
    const patterns = [
      /T(\d+)\s*-/i,       // "T33 -" or "T1 -"
      /T(\d+)\s*\(/i,      // "T33 ("
      /Train\s*(\d+)/i,    // "Train 33"
    ]
    for (const pattern of patterns) {
      const match = filename.match(pattern)
      if (match) return parseInt(match[1], 10)
    }
    return null
  }

  // Excel Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadStatus({ type: 'info', message: 'Reading Excel file...' })

    // Extract train number from filename
    const trainNumber = extractTrainNumber(file.name)
    console.log('Extracted train number:', trainNumber, 'from', file.name)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)

      // Parse all sheets
      const parsedData = {}
      const sheetMapping = {
        'DM 3 CAR': 'DM 3 CAR',
        'Trailer 3 Car': 'Trailer 3 Car',
        'UNDM 3 CAR': 'UNDM 3 CAR',
        'DM 4 Car': 'DM 4 Car',
        'Trailer 4 Car': 'Trailer 4 Car',
        'Special Trailer 4 Car': 'Special Trailer 4 Car',
        'UNDM 4 Car': 'UNDM 4 Car'
      }

      for (const sheetName of workbook.SheetNames) {
        if (sheetName === 'Sign Off Sheet') continue

        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        if (jsonData.length < 2) continue

        // Get unit and car numbers from first row headers
        const unitNo = String(jsonData[0]?.[0] || '').replace('Unit No: ', '').trim()
        const carNo = String(jsonData[0]?.[1] || '').replace('Car No: ', '').trim()

        if (!unitNo || !carNo) continue

        // Initialize unit if not exists
        if (!parsedData[unitNo]) {
          parsedData[unitNo] = { cars: {} }
        }

        // Parse tasks (skip header rows)
        const tasks = []
        for (let i = 2; i < jsonData.length; i++) {
          const row = jsonData[i]
          const taskName = row[0]
          const description = row[1]
          const completed = row[2]
          const inProgress = row[3]
          const dateVal = row[4]
          const initials = row[5]

          if (!taskName || String(taskName).trim() === '') continue

          let status = 'pending'
          if (completed === 'Yes') status = 'completed'
          else if (inProgress === 'Yes') status = 'in_progress'

          let completedAt = null
          if (dateVal) {
            try {
              if (typeof dateVal === 'number') {
                // Excel date serial number
                const date = new Date((dateVal - 25569) * 86400 * 1000)
                if (!isNaN(date.getTime())) {
                  completedAt = date.toISOString()
                }
              } else if (typeof dateVal === 'string' && dateVal.trim()) {
                const date = new Date(dateVal)
                if (!isNaN(date.getTime())) {
                  completedAt = date.toISOString()
                }
              }
            } catch (e) {
              // Invalid date, leave as null
              console.log('Invalid date value:', dateVal)
            }
          }

          const initialsArray = initials
            ? String(initials).split(/[,\s\/]+/).map(s => s.trim().toUpperCase()).filter(s => s && s !== 'NAN')
            : []

          tasks.push({
            task_name: String(taskName).trim(),
            description: description ? String(description).trim() : '',
            status,
            completed_at: status === 'completed' ? completedAt : null,
            completed_by: initialsArray
          })
        }

        parsedData[unitNo].cars[sheetMapping[sheetName] || sheetName] = {
          car_number: carNo,
          tasks
        }
      }

      // Now sync to database
      setUploadStatus({ type: 'info', message: 'Syncing to database...' })

      // Generate train_name from all unit numbers in this file
      const unitNumbers = Object.keys(parsedData).sort()
      let trainName = `Train ${unitNumbers.map(u => u.slice(-3)).join('-')}`
      if (trainNumber) {
        trainName = `T${trainNumber} (${trainName})`
      }

      for (const [unitNumber, unitData] of Object.entries(parsedData)) {
        // Check if unit exists
        let { data: existingUnit } = await supabase
          .from('train_units')
          .select('id')
          .eq('unit_number', unitNumber)
          .single()

        let unitId
        if (existingUnit) {
          unitId = existingUnit.id
          // Update train_name and train_number for existing unit
          await supabase
            .from('train_units')
            .update({
              train_name: trainName,
              train_number: trainNumber,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', unitId)
        } else {
          // Create new unit with train_name and train_number
          const { data: newUnit } = await supabase
            .from('train_units')
            .insert({
              unit_number: unitNumber,
              train_name: trainName,
              train_number: trainNumber,
              last_synced_at: new Date().toISOString()
            })
            .select()
            .single()
          unitId = newUnit.id
        }

        // Process each car type
        for (const [carTypeName, carData] of Object.entries(unitData.cars)) {
          // Find car type
          const carType = carTypes.find(ct => ct.name === carTypeName)
          if (!carType) continue

          // Check if car exists
          let { data: existingCar } = await supabase
            .from('cars')
            .select('id')
            .eq('unit_id', unitId)
            .eq('car_type_id', carType.id)
            .single()

          let carId
          if (existingCar) {
            carId = existingCar.id
            // Delete existing task completions for this car
            await supabase
              .from('task_completions')
              .delete()
              .eq('car_id', carId)
          } else {
            // Create new car
            const { data: newCar } = await supabase
              .from('cars')
              .insert({
                unit_id: unitId,
                car_type_id: carType.id,
                car_number: carData.car_number
              })
              .select()
              .single()
            carId = newCar.id
          }

          // Insert task completions
          const completions = carData.tasks.map((task, idx) => ({
            car_id: carId,
            task_name: task.task_name,
            description: task.description,
            status: task.status,
            completed_at: task.completed_at,
            completed_by: task.completed_by,
            sort_order: idx + 1
          }))

          if (completions.length > 0) {
            await supabase.from('task_completions').insert(completions)
          }
        }
      }

      setUploadStatus({ type: 'success', message: `Successfully imported ${Object.keys(parsedData).length} unit(s)!` })

      // Reload data
      await loadData()

    } catch (error) {
      console.error('Error uploading:', error)
      setUploadStatus({ type: 'error', message: `Error: ${error.message}` })
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <Check size={14} />
      case 'in_progress':
        return <Clock size={14} />
      default:
        return <Circle size={14} />
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading...
      </div>
    )
  }

  return (
    <div className="task-tracker">
      {/* Hidden file input for Excel upload (triggered from navbar) */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Upload Status */}
      {(uploading || uploadStatus) && (
        <div className="upload-section" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
              <span>Uploading...</span>
            </div>
          )}

          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.type}`}>
              <AlertCircle size={16} />
              {uploadStatus.message}
            </div>
          )}
        </div>
      )}

      {/* Train Selector */}
      {trains.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {/* Train Selector Header with Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                onClick={() => setIsTrainSelectorCollapsed(!isTrainSelectorCollapsed)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-secondary)'
                }}
              >
                {isTrainSelectorCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                <span style={{ fontWeight: '600' }}>
                  Trains ({(() => {
                    const filtered = trains.filter(train => {
                      const stats = trainCompletionData[train.name]
                      if (statusFilter === 'in_progress') return stats?.inProgress > 0
                      if (statusFilter === 'pending') return stats?.pending > 0
                      if (statusFilter === 'completed') return stats?.completed > 0
                      return true
                    })
                    return filtered.length
                  })()})
                  {selectedTrains.length > 1 && !viewAllTrains && ` • ${selectedTrains.length} selected`}
                  {viewAllTrains && ' • All'}
                </span>
              </div>

              {/* All Trains Toggle */}
              <button
                onClick={() => {
                  const newViewAllTrains = !viewAllTrains
                  setViewAllTrains(newViewAllTrains)
                  if (newViewAllTrains) {
                    setSelectedTrains([])
                    setSelectedCar(null)
                    setViewAllCars(true) // Automatically show all cars when viewing all trains
                  } else {
                    setViewAllCars(false)
                  }
                }}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: viewAllTrains ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: viewAllTrains ? 'var(--primary)' : 'transparent',
                  color: viewAllTrains ? 'white' : 'var(--text)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                All Trains
              </button>

              {/* Clear Selection Button */}
              {(viewAllTrains || selectedTrains.length > 1) && (
                <button
                  onClick={() => {
                    setViewAllTrains(false)
                    setSelectedTrains(trains.length > 0 ? [trains[0]] : [])
                    setSelectedCar(null)
                  }}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Clear
                </button>
              )}

              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                Shift+click range • Ctrl+click toggle
              </span>
            </div>

            {/* Train Dropdown */}
            <select
              value={selectedTrains.length === 1 ? selectedTrains[0]?.name : ''}
              onChange={(e) => {
                const train = trains.find(t => t.name === e.target.value)
                if (train) {
                  setSelectedTrains([train])
                  setViewAllTrains(false)
                  setSelectedCar(null)
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                minWidth: '200px'
              }}
            >
              {trains
                .filter(train => {
                  const stats = trainCompletionData[train.name]
                  if (statusFilter === 'in_progress') return stats?.inProgress > 0
                  if (statusFilter === 'pending') return stats?.pending > 0
                  if (statusFilter === 'completed') return stats?.completed > 0
                  return true
                })
                .map(train => {
                  const stats = trainCompletionData[train.name]
                  return (
                    <option key={train.name} value={train.name}>
                      T{train.trainNumber} - {stats?.percent || 0}% ({train.phase || 'No Phase'})
                    </option>
                  )
                })}
            </select>
          </div>

          {/* Train Buttons Grid */}
          {!isTrainSelectorCollapsed && (() => {
            const filteredTrainsList = getFilteredTrains()
            return (
            <div className="unit-selector">
              {filteredTrainsList.map(train => {
                  const stats = trainCompletionData[train.name]
                  const percent = stats?.percent || 0
                  const progressColor = percent === 100 ? '#10B981' :
                                       percent >= 80 ? '#84CC16' :
                                       percent >= 50 ? '#FACC15' :
                                       percent >= 20 ? '#F59E0B' :
                                       percent > 0 ? '#EF4444' : '#475569'

                  const isSelected = viewAllTrains || selectedTrains.some(t => t.name === train.name)

                  return (
                    <button
                      key={train.name}
                      className={`unit-btn ${isSelected ? 'active' : ''}`}
                      onClick={(e) => handleTrainClick(train, e, filteredTrainsList)}
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        outline: isSelected && selectedTrains.length > 1 ? '2px solid var(--primary)' : 'none'
                      }}
                    >
                      {/* Progress bar background */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        height: '4px',
                        width: `${percent}%`,
                        background: progressColor,
                        transition: 'width 0.3s ease'
                      }} />

                      <Train size={20} />
                      <span>{train.trainNumber ? `T${train.trainNumber}` : train.name}</span>

                      {/* Completion percentage badge */}
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '9999px',
                        background: progressColor,
                        color: percent >= 50 ? '#000' : '#fff',
                        marginLeft: '0.25rem',
                        fontWeight: '600'
                      }}>
                        {percent}%
                      </span>

                      {train.phase && (
                        <span style={{ fontSize: '0.625rem', opacity: 0.5, marginLeft: '0.25rem' }}>
                          {train.phase}
                        </span>
                      )}

                      {/* Show in-progress count if filtering by in_progress */}
                      {statusFilter === 'in_progress' && stats?.inProgress > 0 && (
                        <span style={{
                          fontSize: '0.625rem',
                          padding: '0.125rem 0.25rem',
                          borderRadius: '0.25rem',
                          background: '#F59E0B',
                          color: '#000',
                          marginLeft: '0.25rem'
                        }}>
                          {stats.inProgress} in progress
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
            )
          })()}
        </div>
      )}

      {/* Visual Train */}
      {selectedTrain && cars.length > 0 && (
        <div className="train-visual">
          {/* Collapsible Header for Car Visual */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 1rem',
              background: 'var(--bg-secondary)',
              borderRadius: '0.5rem',
              marginBottom: isCarVisualCollapsed ? 0 : '0.75rem'
            }}
          >
            <div
              onClick={() => setIsCarVisualCollapsed(!isCarVisualCollapsed)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}
            >
              {isCarVisualCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              <span style={{ fontWeight: '600' }}>Train Cars ({displayCars.length})</span>
              <span style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '9999px'
              }}>
                {(() => {
                  const totalCompleted = displayCars.reduce((acc, car) => {
                    const p = getCarProgress(car)
                    return acc + p.completed
                  }, 0)
                  const totalTasks = displayCars.reduce((acc, car) => {
                    const p = getCarProgress(car)
                    return acc + p.total
                  }, 0)
                  const percent = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0
                  return `${totalCompleted}/${totalTasks} (${percent}%)`
                })()}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* All Cars Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setViewAllCars(!viewAllCars)
                  if (!viewAllCars) setSelectedCar(null)
                }}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: viewAllCars ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: viewAllCars ? 'var(--primary)' : 'transparent',
                  color: viewAllCars ? 'white' : 'var(--text)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                All Cars
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isCarVisualCollapsed ? 'Click to expand' : ''}
              </span>
            </div>
          </div>

          {/* Car Visual Container */}
          {!isCarVisualCollapsed && (
            <div className="train-container">
              {displayCars.map((car, idx) => {
                const progress = getCarProgress(car)
                const isSelected = selectedCar?.id === car.id
                const is3Car = car.car_types?.category === '3 CAR'

                // For aggregated view, show separator between 3 CAR and 4 CAR groups
                const prevCar = idx > 0 ? displayCars[idx - 1] : null
                const showCarTypeSeparator = idx > 0 && is3Car === false && prevCar?.car_types?.category === '3 CAR'

                // Only show train separators for non-aggregated view
                const isNewTrain = !car.isAggregated && (idx === 0 || car.trainNumber !== prevCar?.trainNumber)

                // Check if car has tasks matching the current filter
                const hasMatchingTasks = statusFilter === 'all' ? true :
                  car.task_completions?.some(t => t.status === statusFilter)
                const matchingCount = statusFilter === 'all' ? 0 :
                  car.task_completions?.filter(t => t.status === statusFilter).length || 0

                return (
                  <div key={car.id} style={{ display: 'contents' }}>
                    {/* For aggregated view, show label with train count */}
                    {car.isAggregated && idx === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-20px',
                        left: '0',
                        fontSize: '0.625rem',
                        fontWeight: '700',
                        background: 'var(--primary)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {car.trainNumbers?.length > 1
                          ? `${car.trainNumbers.length} Trains (${car.trainNumbers.map(n => `T${n}`).join(', ')})`
                          : `T${car.trainNumbers?.[0] || ''}`}
                      </div>
                    )}
                    {showCarTypeSeparator && (
                      <div style={{
                        width: '4px',
                        height: '100px',
                        background: 'linear-gradient(180deg, var(--primary) 0%, var(--bg-card) 100%)',
                        borderRadius: '2px',
                        margin: '10px 8px',
                        alignSelf: 'center'
                      }} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {/* Filter indicator radio above car */}
                      {statusFilter !== 'all' && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginBottom: '4px',
                          padding: '2px 6px',
                          borderRadius: '12px',
                          background: hasMatchingTasks ? (
                            statusFilter === 'completed' ? '#10B981' :
                            statusFilter === 'in_progress' ? '#F59E0B' :
                            '#6B7280'
                          ) : 'transparent',
                          border: hasMatchingTasks ? 'none' : '1px solid var(--border)',
                          minHeight: '20px'
                        }}>
                          {hasMatchingTasks && (
                            <>
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: 'white',
                                boxShadow: '0 0 4px rgba(255,255,255,0.5)'
                              }} />
                              <span style={{
                                fontSize: '0.625rem',
                                color: 'white',
                                fontWeight: '600'
                              }}>
                                {matchingCount}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <div
                        className={`train-car ${isSelected && !viewAllCars ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedCar(car)
                          setViewAllCars(false)
                        }}
                        style={{
                          borderColor: isSelected && !viewAllCars ? '#3B82F6' : getCarColor(progress.percent)
                        }}
                      >
                        <div
                          className="car-progress-fill"
                          style={{
                            width: `${progress.percent}%`,
                            backgroundColor: getCarColor(progress.percent)
                          }}
                        />
                        <div className="car-content">
                          <div className="car-type">
                            {car.isAggregated
                              ? car.displayName
                              : car.car_types?.name?.replace(' 3 CAR', '').replace(' 4 Car', '').replace(' 3 Car', '')}
                          </div>
                          <div className="car-number">
                            {car.isAggregated
                              ? (car.trainNumbers?.length > 1 ? `${car.trainNumbers.length} trains` : `#${car.sourceCars?.[0]?.car_number || ''}`)
                              : `#${car.car_number}`}
                          </div>
                          <div className="car-stats">{progress.completed}/{progress.total}</div>
                          <div className="car-percent">{progress.percent}%</div>
                        </div>
                        {idx === 0 && <div className="train-front" />}
                        {idx === displayCars.length - 1 && <div className="train-back" />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Task List for Selected Car or All Cars */}
      {(selectedCar || viewAllCars) && (
        <div className="task-panel">
          <div
            className="task-panel-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}
          >
            <div
              onClick={() => setIsTaskListCollapsed(!isTaskListCollapsed)}
              style={{ cursor: 'pointer' }}
            >
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {viewAllCars ? (
                  viewAllTrains ? 'All Trains - All Cars' :
                  selectedTrains.length > 1 ? `${selectedTrains.length} Trains - All Cars` :
                  `All Cars - ${selectedTrain?.trainNumber ? `T${selectedTrain.trainNumber}` : selectedTrain?.name}`
                ) : (
                  selectedCar?.trainNumber ?
                    `T${selectedCar.trainNumber} - ${selectedCar.car_types?.name} #${selectedCar.car_number}` :
                    `${selectedCar?.car_types?.name} - Car #${selectedCar?.car_number}`
                )}
                {isTaskListCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </h2>
              <div className="task-panel-stats">
                {(() => {
                  // Build regex for text filter
                  let textRegex = null
                  try {
                    if (taskTextFilter) textRegex = new RegExp(taskTextFilter, 'i')
                  } catch (e) { textRegex = null }

                  const matchesTextFilter = (task) => {
                    if (!taskTextFilter) return true
                    const searchText = `${task.task_name || ''} ${task.description || ''}`.toLowerCase()
                    if (textRegex) return textRegex.test(searchText)
                    return searchText.includes(taskTextFilter.toLowerCase())
                  }

                  if (viewAllCars) {
                    const allCarTasks = cars.flatMap(c => c.task_completions || [])
                    const total = allCarTasks.length
                    const completed = allCarTasks.filter(t => t.status === 'completed').length
                    const filteredTasks = allCarTasks.filter(t =>
                      (statusFilter === 'all' || t.status === statusFilter) &&
                      (phaseFilter === 'all' || (t.phase || 'No Phase') === phaseFilter) &&
                      matchesTextFilter(t)
                    )
                    const filteredCompleted = filteredTasks.filter(t => t.status === 'completed').length
                    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
                    if (statusFilter !== 'all' || phaseFilter !== 'all' || taskTextFilter) {
                      return `Showing ${filteredTasks.length} tasks (${filteredCompleted} completed) | Total: ${completed}/${total} (${percent}%)`
                    }
                    return `${completed} of ${total} tasks completed (${percent}%)`
                  }
                  const p = getCarProgress(selectedCar)
                  const filteredTasks = (selectedCar.task_completions || []).filter(t =>
                    (statusFilter === 'all' || t.status === statusFilter) &&
                    (phaseFilter === 'all' || (t.phase || 'No Phase') === phaseFilter) &&
                    matchesTextFilter(t)
                  )
                  const filteredCompleted = filteredTasks.filter(t => t.status === 'completed').length
                  if (statusFilter !== 'all' || phaseFilter !== 'all' || taskTextFilter) {
                    return `Showing ${filteredTasks.length} tasks (${filteredCompleted} completed) | Total: ${p.completed}/${p.total} (${p.percent}%)`
                  }
                  return `${p.completed} of ${p.total} tasks completed (${p.percent}%)`
                })()}
              </div>
            </div>

            {/* All Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />

              {/* Text/Regex Filter */}
              <input
                type="text"
                value={taskTextFilter}
                onChange={(e) => setTaskTextFilter(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Filter tasks (regex)..."
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                  minWidth: '180px'
                }}
              />

              {/* Phase Filter */}
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Phases</option>
                {selectedCar?.task_completions && getUniquePhases(selectedCar.task_completions).map(phase => (
                  <option key={phase} value={phase}>{phase}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Tasks</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Not Started</option>
              </select>

              {(taskTextFilter || phaseFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={(e) => { e.stopPropagation(); setTaskTextFilter(''); setPhaseFilter('all'); setStatusFilter('all'); }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <span
              onClick={() => setIsTaskListCollapsed(!isTaskListCollapsed)}
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Click to {isTaskListCollapsed ? 'expand' : 'collapse'}
            </span>
          </div>

          {!isTaskListCollapsed && (
            <div className="task-list">
              {/* Collapse/Expand All Controls */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', padding: '0 0.5rem' }}>
                <button
                  onClick={() => toggleAllPhases(true)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Collapse All
                </button>
                <button
                  onClick={() => toggleAllPhases(false)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Expand All
                </button>
              </div>

              {/* Group tasks by phase */}
              {(() => {
                // Get tasks from all cars or selected car
                const sourceTasks = viewAllCars
                  ? cars.flatMap(c => (c.task_completions || []).map(t => ({ ...t, carName: c.car_types?.name, carNumber: c.car_number, trainNumber: c.trainNumber })))
                  : (selectedCar?.task_completions || [])

                // Build regex for text filter (case insensitive)
                let textRegex = null
                try {
                  if (taskTextFilter) {
                    textRegex = new RegExp(taskTextFilter, 'i')
                  }
                } catch (e) {
                  // Invalid regex, fall back to simple includes
                  textRegex = null
                }

                const allTasks = sourceTasks
                  .filter(task => statusFilter === 'all' || task.status === statusFilter)
                  .filter(task => phaseFilter === 'all' || (task.phase || 'No Phase') === phaseFilter)
                  .filter(task => {
                    if (!taskTextFilter) return true
                    const searchText = `${task.task_name || ''} ${task.description || ''}`.toLowerCase()
                    if (textRegex) {
                      return textRegex.test(searchText)
                    }
                    return searchText.includes(taskTextFilter.toLowerCase())
                  })

                if (allTasks.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No tasks match the current filter
                    </div>
                  )
                }

                const groupedTasks = groupTasksByPhase(allTasks)
                const sortedPhases = getUniquePhases(allTasks)

                return sortedPhases.map(phase => {
                  const phaseTasks = groupedTasks[phase] || []
                  const completedCount = phaseTasks.filter(t => t.status === 'completed').length
                  const isCollapsed = collapsedPhases[phase]

                  // Get phase color based on completion
                  const phasePercent = phaseTasks.length > 0 ? Math.round((completedCount / phaseTasks.length) * 100) : 0
                  const phaseColor = phasePercent === 100 ? '#10B981' :
                                     phasePercent >= 50 ? '#F59E0B' :
                                     phasePercent > 0 ? '#EF4444' : '#475569'

                  return (
                    <div key={phase} style={{ marginBottom: '0.5rem' }}>
                      {/* Phase Header */}
                      <div
                        onClick={() => togglePhaseCollapse(phase)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          borderLeft: `4px solid ${phaseColor}`,
                          marginBottom: isCollapsed ? 0 : '0.25rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                          <span style={{ fontWeight: '600' }}>{phase}</span>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.5rem',
                            background: phaseColor,
                            color: 'white',
                            borderRadius: '9999px'
                          }}>
                            {completedCount}/{phaseTasks.length} ({phasePercent}%)
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {isCollapsed ? 'Click to expand' : 'Click to collapse'}
                        </span>
                      </div>

                      {/* Phase Tasks */}
                      {!isCollapsed && phaseTasks
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                        .map(task => (
                        <div
                          key={task.id}
                          className={`task-item ${task.status}`}
                          onClick={() => openTaskModal(task)}
                        >
                          <div className="task-status">
                            <span className={`status-badge status-${task.status}`}>
                              {getStatusIcon(task.status)}
                            </span>
                          </div>
                          <div className="task-info">
                            <div className="task-name">{task.task_name}</div>
                            {task.description && (
                              <div className="task-desc">{task.description}</div>
                            )}
                            {/* Show car info when viewing all cars */}
                            {viewAllCars && task.carName && (
                              <div style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                marginTop: '0.25rem',
                                padding: '0.125rem 0.375rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '0.25rem',
                                display: 'inline-block'
                              }}>
                                {task.carName?.replace(' 3 CAR', '').replace(' 4 Car', '').replace(' 3 Car', '')} #{task.carNumber}
                              </div>
                            )}
                          </div>
                          <div className="task-meta">
                            {task.completed_by?.length > 0 && (
                              <div className="task-initials">
                                {task.completed_by.slice(0, 4).map((init, i) => (
                                  <span key={i} className="initial-badge">{init}</span>
                                ))}
                                {task.completed_by.length > 4 && (
                                  <span className="initial-more">+{task.completed_by.length - 4}</span>
                                )}
                              </div>
                            )}
                            {task.completed_at && (
                              <div className="task-date">
                                {new Date(task.completed_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {trains.length === 0 && (
        <div className="empty-state">
          <Train size={64} />
          <h3>No Trains</h3>
          <p>Upload an Excel file to import train data</p>
        </div>
      )}

      {/* Task Edit Modal */}
      {modalOpen && selectedTask && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Task</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task</label>
                  <input
                    type="text"
                    className="form-control"
                    value={selectedTask.task_name}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Team</label>
                  <select
                    className="form-control"
                    value={formData.team_id}
                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  >
                    <option value="">Select Team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Completed By (initials, comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., SA, UQ, CP, MJ"
                    value={formData.completed_by}
                    onChange={(e) => setFormData({ ...formData, completed_by: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  <Check size={16} />
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskTracker
