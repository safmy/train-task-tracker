import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Check, Clock, Circle, X, Upload, Train, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

function TaskTracker() {
  const [units, setUnits] = useState([])
  const [selectedUnit, setSelectedUnit] = useState(null)
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

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedUnit) {
      loadCarsForUnit(selectedUnit.id)
    }
  }, [selectedUnit])

  const loadData = async () => {
    setLoading(true)
    try {
      const [unitsRes, teamsRes, carTypesRes] = await Promise.all([
        supabase.from('train_units').select('*').eq('is_active', true).order('unit_number'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('car_types').select('*').order('name')
      ])

      if (unitsRes.data) setUnits(unitsRes.data)
      if (teamsRes.data) setTeams(teamsRes.data)
      if (carTypesRes.data) setCarTypes(carTypesRes.data)

      if (unitsRes.data && unitsRes.data.length > 0) {
        setSelectedUnit(unitsRes.data[0])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }

  const loadCarsForUnit = async (unitId) => {
    try {
      const { data: carsData } = await supabase
        .from('cars')
        .select('*, car_types(*), task_completions(*, teams(*))')
        .eq('unit_id', unitId)
        .order('car_number')

      if (carsData) {
        setCars(carsData)
        // Flatten all completions
        const allCompletions = carsData.flatMap(c => c.task_completions || [])
        setTaskCompletions(allCompletions)

        // Auto-select first car
        if (carsData.length > 0 && !selectedCar) {
          setSelectedCar(carsData[0])
        }
      }
    } catch (error) {
      console.error('Error loading cars:', error)
    }
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

  const getCarColor = (percent) => {
    if (percent >= 80) return '#10B981'
    if (percent >= 50) return '#F59E0B'
    if (percent > 0) return '#EF4444'
    return '#475569'
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

      await loadCarsForUnit(selectedUnit.id)
      setModalOpen(false)
    } catch (error) {
      console.error('Error saving completion:', error)
    }
  }

  // Excel Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadStatus({ type: 'info', message: 'Reading Excel file...' })

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
            if (typeof dateVal === 'number') {
              // Excel date serial number
              const date = new Date((dateVal - 25569) * 86400 * 1000)
              completedAt = date.toISOString()
            } else if (typeof dateVal === 'string') {
              completedAt = new Date(dateVal).toISOString()
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
        } else {
          // Create new unit
          const { data: newUnit } = await supabase
            .from('train_units')
            .insert({ unit_number: unitNumber })
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
      {/* Upload Section */}
      <div className="upload-section">
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload Excel'}
        </button>
        {uploadStatus && (
          <div className={`upload-status ${uploadStatus.type}`}>
            <AlertCircle size={16} />
            {uploadStatus.message}
          </div>
        )}
      </div>

      {/* Unit Selector */}
      {units.length > 0 && (
        <div className="unit-selector">
          {units.map(unit => (
            <button
              key={unit.id}
              className={`unit-btn ${selectedUnit?.id === unit.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedUnit(unit)
                setSelectedCar(null)
              }}
            >
              <Train size={20} />
              <span>Unit {unit.unit_number}</span>
            </button>
          ))}
        </div>
      )}

      {/* Visual Train */}
      {selectedUnit && cars.length > 0 && (
        <div className="train-visual">
          <div className="train-container">
            {cars.map((car, idx) => {
              const progress = getCarProgress(car)
              const isSelected = selectedCar?.id === car.id

              return (
                <div
                  key={car.id}
                  className={`train-car ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedCar(car)}
                  style={{
                    borderColor: isSelected ? '#3B82F6' : getCarColor(progress.percent)
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
                    <div className="car-type">{car.car_types?.name?.replace(' 3 CAR', '').replace(' 4 Car', '').replace(' 3 Car', '')}</div>
                    <div className="car-number">#{car.car_number}</div>
                    <div className="car-stats">{progress.completed}/{progress.total}</div>
                    <div className="car-percent">{progress.percent}%</div>
                  </div>
                  {idx === 0 && <div className="train-front" />}
                  {idx === cars.length - 1 && <div className="train-back" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Task List for Selected Car */}
      {selectedCar && (
        <div className="task-panel">
          <div className="task-panel-header">
            <h2>{selectedCar.car_types?.name} - Car #{selectedCar.car_number}</h2>
            <div className="task-panel-stats">
              {(() => {
                const p = getCarProgress(selectedCar)
                return `${p.completed} of ${p.total} tasks completed (${p.percent}%)`
              })()}
            </div>
          </div>

          <div className="task-list">
            {(selectedCar.task_completions || [])
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
        </div>
      )}

      {/* Empty State */}
      {units.length === 0 && (
        <div className="empty-state">
          <Train size={64} />
          <h3>No Train Units</h3>
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
