import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronRight, Check, Clock, Circle, X, Plus, Users } from 'lucide-react'

function TaskTracker() {
  const [units, setUnits] = useState([])
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [cars, setCars] = useState([])
  const [teams, setTeams] = useState([])
  const [taskTemplates, setTaskTemplates] = useState([])
  const [taskCompletions, setTaskCompletions] = useState([])
  const [expandedCars, setExpandedCars] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({
    status: 'completed',
    team_id: '',
    completed_by: '',
    notes: ''
  })

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
      const [unitsRes, teamsRes, templatesRes] = await Promise.all([
        supabase.from('train_units').select('*').eq('is_active', true).order('unit_number'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('task_templates').select('*, car_types(*)').order('sort_order')
      ])

      if (unitsRes.data) setUnits(unitsRes.data)
      if (teamsRes.data) setTeams(teamsRes.data)
      if (templatesRes.data) setTaskTemplates(templatesRes.data)

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
        .select('*, car_types(*)')
        .eq('unit_id', unitId)
        .order('car_number')

      if (carsData) {
        setCars(carsData)
        const carIds = carsData.map(c => c.id)

        if (carIds.length > 0) {
          const { data: completions } = await supabase
            .from('task_completions')
            .select('*, teams(*)')
            .in('car_id', carIds)

          if (completions) setTaskCompletions(completions)
        }

        // Auto-expand first car
        if (carsData.length > 0) {
          setExpandedCars({ [carsData[0].id]: true })
        }
      }
    } catch (error) {
      console.error('Error loading cars:', error)
    }
  }

  const toggleCarExpand = (carId) => {
    setExpandedCars(prev => ({
      ...prev,
      [carId]: !prev[carId]
    }))
  }

  const getTasksForCarType = (carTypeId) => {
    return taskTemplates.filter(t => t.car_type_id === carTypeId)
  }

  const getCompletion = (carId, templateId) => {
    return taskCompletions.find(c => c.car_id === carId && c.task_template_id === templateId)
  }

  const getCarProgress = (car) => {
    const tasks = getTasksForCarType(car.car_type_id)
    if (tasks.length === 0) return { completed: 0, total: 0, percent: 0 }

    const completed = tasks.filter(t => {
      const completion = getCompletion(car.id, t.id)
      return completion?.status === 'completed'
    }).length

    return {
      completed,
      total: tasks.length,
      percent: Math.round((completed / tasks.length) * 100)
    }
  }

  const openTaskModal = (car, template) => {
    const completion = getCompletion(car.id, template.id)
    setSelectedTask({ car, template, completion })
    setFormData({
      status: completion?.status || 'completed',
      team_id: completion?.team_id || '',
      completed_by: completion?.completed_by?.join(', ') || '',
      notes: completion?.notes || ''
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTask) return

    const { car, template, completion } = selectedTask
    const initialsArray = formData.completed_by
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0)

    const payload = {
      car_id: car.id,
      task_template_id: template.id,
      status: formData.status,
      team_id: formData.team_id || null,
      completed_by: initialsArray,
      notes: formData.notes,
      completed_at: formData.status === 'completed' ? new Date().toISOString() : null
    }

    try {
      if (completion) {
        await supabase
          .from('task_completions')
          .update(payload)
          .eq('id', completion.id)
      } else {
        await supabase
          .from('task_completions')
          .insert([payload])
      }

      // Reload completions
      await loadCarsForUnit(selectedUnit.id)
      setModalOpen(false)
    } catch (error) {
      console.error('Error saving completion:', error)
    }
  }

  const resetTask = async () => {
    if (!selectedTask?.completion) return

    try {
      await supabase
        .from('task_completions')
        .delete()
        .eq('id', selectedTask.completion.id)

      await loadCarsForUnit(selectedUnit.id)
      setModalOpen(false)
    } catch (error) {
      console.error('Error resetting task:', error)
    }
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
      <div className="tracker-header">
        <div className="form-group">
          <label className="form-label">Select Train Unit</label>
          <select
            className="form-control"
            value={selectedUnit?.id || ''}
            onChange={(e) => {
              const unit = units.find(u => u.id === e.target.value)
              setSelectedUnit(unit)
            }}
          >
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedUnit && (
        <>
          <div className="unit-tabs">
            {units.map(unit => (
              <button
                key={unit.id}
                className={`unit-tab ${selectedUnit.id === unit.id ? 'active' : ''}`}
                onClick={() => setSelectedUnit(unit)}
              >
                {unit.unit_number}
              </button>
            ))}
          </div>

          {cars.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Plus size={48} />
              </div>
              <div className="empty-state-title">No cars configured</div>
              <p>Go to Admin panel to add cars for this unit</p>
            </div>
          ) : (
            cars.map(car => {
              const progress = getCarProgress(car)
              const tasks = getTasksForCarType(car.car_type_id)
              const isExpanded = expandedCars[car.id]

              return (
                <div key={car.id} className="car-section">
                  <div className="car-header" onClick={() => toggleCarExpand(car.id)}>
                    <h3>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      {car.car_types?.name}
                      <span className="car-number">Car #{car.car_number}</span>
                    </h3>
                    <div className="progress-badge">
                      <div className="progress-bar-mini">
                        <div
                          className="progress-bar-mini-fill"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <span>{progress.completed}/{progress.total} ({progress.percent}%)</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <table className="task-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>Status</th>
                          <th>Task</th>
                          <th>Description</th>
                          <th style={{ width: '150px' }}>Team</th>
                          <th style={{ width: '150px' }}>Completed By</th>
                          <th style={{ width: '120px' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map(template => {
                          const completion = getCompletion(car.id, template.id)
                          const status = completion?.status || 'pending'

                          return (
                            <tr
                              key={template.id}
                              className={`task-row ${status}`}
                              onClick={() => openTaskModal(car, template)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <span className={`status-badge status-${status}`}>
                                  {getStatusIcon(status)}
                                </span>
                              </td>
                              <td><strong>{template.task_name}</strong></td>
                              <td>{template.description}</td>
                              <td>
                                {completion?.teams && (
                                  <span className="team-badge">
                                    <span
                                      className="team-color"
                                      style={{ backgroundColor: completion.teams.color }}
                                    />
                                    {completion.teams.name}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="initials-list">
                                  {completion?.completed_by?.map((initial, idx) => (
                                    <span key={idx} className="initial-badge">{initial}</span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                {completion?.completed_at &&
                                  new Date(completion.completed_at).toLocaleDateString()
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })
          )}
        </>
      )}

      {/* Task Completion Modal */}
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
                    value={selectedTask.template.task_name}
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
                {selectedTask.completion && (
                  <button type="button" className="btn btn-danger" onClick={resetTask}>
                    Reset Task
                  </button>
                )}
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
