import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Edit2, X, Train, Users, Car, ClipboardList, Upload } from 'lucide-react'

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('units')
  const [units, setUnits] = useState([])
  const [teams, setTeams] = useState([])
  const [carTypes, setCarTypes] = useState([])
  const [taskTemplates, setTaskTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [formData, setFormData] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [unitsRes, teamsRes, carTypesRes, templatesRes] = await Promise.all([
        supabase.from('train_units').select('*, cars(*, car_types(*))').order('unit_number'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('car_types').select('*').order('name'),
        supabase.from('task_templates').select('*, car_types(*)').order('car_type_id, sort_order')
      ])

      if (unitsRes.data) setUnits(unitsRes.data)
      if (teamsRes.data) setTeams(teamsRes.data)
      if (carTypesRes.data) setCarTypes(carTypesRes.data)
      if (templatesRes.data) setTaskTemplates(templatesRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }

  const openModal = (type, item = null) => {
    setModalType(type)
    setEditItem(item)

    if (type === 'unit') {
      setFormData(item ? { unit_number: item.unit_number } : { unit_number: '' })
    } else if (type === 'team') {
      setFormData(item ? { name: item.name, color: item.color } : { name: '', color: '#3B82F6' })
    } else if (type === 'car') {
      setFormData(item ? {
        unit_id: item.unit_id,
        car_type_id: item.car_type_id,
        car_number: item.car_number
      } : {
        unit_id: units[0]?.id || '',
        car_type_id: carTypes[0]?.id || '',
        car_number: ''
      })
    } else if (type === 'template') {
      setFormData(item ? {
        car_type_id: item.car_type_id,
        task_name: item.task_name,
        description: item.description,
        sort_order: item.sort_order
      } : {
        car_type_id: carTypes[0]?.id || '',
        task_name: '',
        description: '',
        sort_order: 0
      })
    }

    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (modalType === 'unit') {
        if (editItem) {
          await supabase.from('train_units').update(formData).eq('id', editItem.id)
        } else {
          await supabase.from('train_units').insert([formData])
        }
      } else if (modalType === 'team') {
        if (editItem) {
          await supabase.from('teams').update(formData).eq('id', editItem.id)
        } else {
          await supabase.from('teams').insert([formData])
        }
      } else if (modalType === 'car') {
        if (editItem) {
          await supabase.from('cars').update(formData).eq('id', editItem.id)
        } else {
          await supabase.from('cars').insert([formData])
        }
      } else if (modalType === 'template') {
        if (editItem) {
          await supabase.from('task_templates').update(formData).eq('id', editItem.id)
        } else {
          await supabase.from('task_templates').insert([formData])
        }
      }

      await loadData()
      setModalOpen(false)
    } catch (error) {
      console.error('Error saving:', error)
      alert('Error saving. Check console for details.')
    }
  }

  const handleDelete = async (type, id) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const table = type === 'unit' ? 'train_units' :
                    type === 'team' ? 'teams' :
                    type === 'car' ? 'cars' :
                    'task_templates'

      await supabase.from(table).delete().eq('id', id)
      await loadData()
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Error deleting. It may have related records.')
    }
  }

  const importDefaultTemplates = async () => {
    if (!confirm('This will add default task templates for all car types. Continue?')) return

    const defaultTasks = {
      'DM 3 CAR': [
        { task_name: 'DM OVERHAUL LINEAR BEARING', description: 'OVERHAUL 24 LINER BEARINGS', sort_order: 1 },
        { task_name: 'DM OVERHAUL PIVOT ASSEMBLY', description: 'OVERHAUL 12 PIVOT ASSEMBLYS', sort_order: 2 },
        { task_name: 'DM OVERHAUL EXTERNAL ACCESS DEVICE', description: 'OVERHAUL 2 EXTERNAL ACCESS DEVICE', sort_order: 3 },
        { task_name: 'DM OVERHAUL LONG ARM & ROLLER', description: 'OVERHAUL 12 LONG ARM & ROLLER', sort_order: 4 },
        { task_name: 'DM OVERHAUL CONNECTING ROD', description: 'OVERHAUL 12 CONNECTING RODS', sort_order: 5 },
        { task_name: 'DM OVERHAUL DOOR ENGINE AND ARMS', description: 'OVERHAUL 12 DOOR ENGINES & ARMS', sort_order: 6 },
        { task_name: 'DM OVERHAUL M DOOR', description: 'OVERHAUL 1 M DOOR', sort_order: 7 },
        { task_name: 'DM OVERHAUL J DOOR & LATCH', description: 'OVERHAUL 1 DOOR & LATCH', sort_order: 8 },
        { task_name: 'DM OVERHAUL J DOOR', description: 'OVERHAUL J DOOR', sort_order: 9 },
        { task_name: 'DM IROC LINEAR SHAFT', description: 'INSPECT 12 LINEAR SHAFTS', sort_order: 10 },
        { task_name: 'DM IROC MANUAL RELEASE LEVER', description: 'INSPECT 4 MANUAL RELEASE LEVERS', sort_order: 11 },
        { task_name: 'DM SILL PLATE DRILLING', description: 'DRILL 32 LOCATIONS ON SILL PLATE', sort_order: 12 }
      ],
      'Trailer 3 Car': [
        { task_name: 'TRAILER OVERHAUL LINEAR BEARING', description: 'OVERHAUL 24 LINER BEARINGS', sort_order: 1 },
        { task_name: 'TRAILER OVERHAUL PIVOT ASSEMBLY', description: 'OVERHAUL 12 PIVOT ASSEMBLYS', sort_order: 2 },
        { task_name: 'TRAILER OVERHAUL EXTERNAL ACCESS DEVICE', description: 'OVERHAUL 2 EXTERNAL ACCESS DEVICE', sort_order: 3 },
        { task_name: 'TRAILER OVERHAUL LONG ARM & ROLLER', description: 'OVERHAUL 12 LONG ARM & ROLLER', sort_order: 4 },
        { task_name: 'TRAILER OVERHAUL CONNECTING ROD', description: 'OVERHAUL 12 CONNECTING RODS', sort_order: 5 },
        { task_name: 'TRAILER OVERHAUL DOOR ENGINE AND ARMS', description: 'OVERHAUL 12 DOOR ENGINES & ARMS', sort_order: 6 },
        { task_name: 'TRAILER IROC LINEAR SHAFT', description: 'INSPECT 12 LINEAR SHAFTS', sort_order: 7 },
        { task_name: 'TRAILER IROC MANUAL RELEASE LEVER', description: 'INSPECT 4 MANUAL RELEASE LEVERS', sort_order: 8 },
        { task_name: 'TRAILER SILL PLATE DRILLING', description: 'DRILL 32 LOCATIONS ON SILL PLATE', sort_order: 9 },
        { task_name: 'TRAILER R&R VALANCE HINGE', description: 'REPLACE 14 VALANCE HINGES', sort_order: 10 },
        { task_name: 'TRAILER R&R WEAR PADS', description: 'REPLACE 32 WEAR PADS', sort_order: 11 },
        { task_name: 'TRAILER R&R VESTIBULE SEALS', description: 'REPLACE 20 VESTIBULE SEALS', sort_order: 12 }
      ],
      'UNDM 3 CAR': [
        { task_name: 'UNDM OVERHAUL LINEAR BEARING', description: 'OVERHAUL 24 LINER BEARINGS', sort_order: 1 },
        { task_name: 'UNDM OVERHAUL PIVOT ASSEMBLY', description: 'OVERHAUL 12 PIVOT ASSEMBLYS', sort_order: 2 },
        { task_name: 'UNDM OVERHAUL EXTERNAL ACCESS DEVICE', description: 'OVERHAUL 2 EXTERNAL ACCESS DEVICE', sort_order: 3 },
        { task_name: 'UNDM OVERHAUL LONG ARM & ROLLER', description: 'OVERHAUL 12 LONG ARM & ROLLER', sort_order: 4 },
        { task_name: 'UNDM OVERHAUL CONNECTING ROD', description: 'OVERHAUL 12 CONNECTING RODS', sort_order: 5 },
        { task_name: 'UNDM OVERHAUL DOOR ENGINE AND ARMS', description: 'OVERHAUL 12 DOOR ENGINES & ARMS', sort_order: 6 },
        { task_name: 'UNDM OVERHAUL SHUNTER OPERATOR', description: 'OVERHAUL SHUNTER OPERATOR', sort_order: 7 },
        { task_name: 'UNDM IROC LINEAR SHAFT', description: 'INSPECT 12 LINEAR SHAFTS', sort_order: 8 },
        { task_name: 'UNDM IROC MANUAL RELEASE LEVER', description: 'INSPECT 4 MANUAL RELEASE LEVERS', sort_order: 9 },
        { task_name: 'UNDM SILL PLATE DRILLING', description: 'DRILL 32 LOCATIONS ON SILL PLATE', sort_order: 10 },
        { task_name: 'UNDM R&R VALANCE HINGE', description: 'REPLACE 14 VALANCE HINGES', sort_order: 11 },
        { task_name: 'UNDM R&R WEAR PADS', description: 'REPLACE 32 WEAR PADS', sort_order: 12 },
        { task_name: 'UNDM R&R VESTIBULE SEALS', description: 'REPLACE 20 VESTIBULE SEALS', sort_order: 13 }
      ]
    }

    try {
      for (const carType of carTypes) {
        const tasks = defaultTasks[carType.name]
        if (tasks) {
          const templatesWithType = tasks.map(t => ({
            ...t,
            car_type_id: carType.id
          }))
          await supabase.from('task_templates').insert(templatesWithType)
        }
      }
      await loadData()
      alert('Default templates imported successfully!')
    } catch (error) {
      console.error('Error importing templates:', error)
      alert('Error importing templates. Some may already exist.')
    }
  }

  const createSampleUnit = async () => {
    if (!confirm('This will create a sample unit 96084 with all car types. Continue?')) return

    try {
      // Create unit
      const { data: unit, error: unitError } = await supabase
        .from('train_units')
        .insert([{ unit_number: '96084' }])
        .select()
        .single()

      if (unitError) throw unitError

      // Create cars for each 3 CAR type
      const carData = [
        { car_type: 'DM 3 CAR', car_number: '96084' },
        { car_type: 'Trailer 3 Car', car_number: '96884' },
        { car_type: 'UNDM 3 CAR', car_number: '96484' }
      ]

      for (const car of carData) {
        const carType = carTypes.find(ct => ct.name === car.car_type)
        if (carType) {
          await supabase.from('cars').insert([{
            unit_id: unit.id,
            car_type_id: carType.id,
            car_number: car.car_number
          }])
        }
      }

      await loadData()
      alert('Sample unit created successfully!')
    } catch (error) {
      console.error('Error creating sample unit:', error)
      alert('Error creating sample unit. Check console for details.')
    }
  }

  const tabs = [
    { id: 'units', label: 'Train Units', icon: Train },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'templates', label: 'Task Templates', icon: ClipboardList }
  ]

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading...
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <h1 style={{ marginBottom: '1.5rem' }}>Admin Panel</h1>

      {/* Tabs */}
      <div className="unit-tabs" style={{ marginBottom: '1.5rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`unit-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} style={{ marginRight: '0.5rem' }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Train Units Tab */}
      {activeTab === 'units' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Train Units & Cars</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={createSampleUnit}>
                <Upload size={14} />
                Create Sample Unit
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => openModal('unit')}>
                <Plus size={14} />
                Add Unit
              </button>
            </div>
          </div>
          <div className="admin-section-body">
            {units.length === 0 ? (
              <div className="empty-state">
                <p>No train units configured. Add a unit to get started.</p>
              </div>
            ) : (
              units.map(unit => (
                <div key={unit.id} style={{ marginBottom: '1.5rem' }}>
                  <div className="admin-list-item">
                    <div className="admin-list-item-left">
                      <Train size={20} />
                      <strong>Unit {unit.unit_number}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        ({unit.cars?.length || 0} cars)
                      </span>
                    </div>
                    <div className="admin-list-item-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openModal('car', { unit_id: unit.id })}>
                        <Plus size={12} />
                        Add Car
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openModal('unit', unit)}>
                        <Edit2 size={12} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete('unit', unit.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {unit.cars && unit.cars.length > 0 && (
                    <ul className="admin-list" style={{ marginLeft: '2rem', marginTop: '0.5rem' }}>
                      {unit.cars.map(car => (
                        <li key={car.id} className="admin-list-item">
                          <div className="admin-list-item-left">
                            <Car size={16} />
                            <span>{car.car_types?.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                              #{car.car_number}
                            </span>
                          </div>
                          <div className="admin-list-item-actions">
                            <button className="btn btn-secondary btn-sm" onClick={() => openModal('car', car)}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete('car', car.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Teams</h2>
            <button className="btn btn-primary btn-sm" onClick={() => openModal('team')}>
              <Plus size={14} />
              Add Team
            </button>
          </div>
          <div className="admin-section-body">
            <ul className="admin-list">
              {teams.map(team => (
                <li key={team.id} className="admin-list-item">
                  <div className="admin-list-item-left">
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: team.color
                      }}
                    />
                    <span>{team.name}</span>
                  </div>
                  <div className="admin-list-item-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openModal('team', team)}>
                      <Edit2 size={12} />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete('team', team.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Task Templates Tab */}
      {activeTab === 'templates' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Task Templates</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={importDefaultTemplates}>
                <Upload size={14} />
                Import Defaults
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => openModal('template')}>
                <Plus size={14} />
                Add Template
              </button>
            </div>
          </div>
          <div className="admin-section-body">
            {carTypes.map(carType => {
              const templatesForType = taskTemplates.filter(t => t.car_type_id === carType.id)
              return (
                <div key={carType.id} style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', color: 'var(--primary)' }}>
                    {carType.name} ({templatesForType.length} tasks)
                  </h4>
                  {templatesForType.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      No templates for this car type
                    </p>
                  ) : (
                    <ul className="admin-list">
                      {templatesForType.map(template => (
                        <li key={template.id} className="admin-list-item">
                          <div className="admin-list-item-left">
                            <div>
                              <div>{template.task_name}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                {template.description}
                              </div>
                            </div>
                          </div>
                          <div className="admin-list-item-actions">
                            <button className="btn btn-secondary btn-sm" onClick={() => openModal('template', template)}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete('template', template.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editItem ? 'Edit' : 'Add'} {
                  modalType === 'unit' ? 'Train Unit' :
                  modalType === 'team' ? 'Team' :
                  modalType === 'car' ? 'Car' :
                  'Task Template'
                }
              </h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {modalType === 'unit' && (
                  <div className="form-group">
                    <label className="form-label">Unit Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.unit_number || ''}
                      onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                      placeholder="e.g., 96084"
                      required
                    />
                  </div>
                )}

                {modalType === 'team' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Team Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Team A"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Color</label>
                      <input
                        type="color"
                        className="form-control"
                        value={formData.color || '#3B82F6'}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        style={{ height: '50px', cursor: 'pointer' }}
                      />
                    </div>
                  </>
                )}

                {modalType === 'car' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Train Unit</label>
                      <select
                        className="form-control"
                        value={formData.unit_id || ''}
                        onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                        required
                      >
                        <option value="">Select Unit</option>
                        {units.map(unit => (
                          <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Car Type</label>
                      <select
                        className="form-control"
                        value={formData.car_type_id || ''}
                        onChange={(e) => setFormData({ ...formData, car_type_id: e.target.value })}
                        required
                      >
                        <option value="">Select Car Type</option>
                        {carTypes.map(ct => (
                          <option key={ct.id} value={ct.id}>{ct.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Car Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.car_number || ''}
                        onChange={(e) => setFormData({ ...formData, car_number: e.target.value })}
                        placeholder="e.g., 96884"
                        required
                      />
                    </div>
                  </>
                )}

                {modalType === 'template' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Car Type</label>
                      <select
                        className="form-control"
                        value={formData.car_type_id || ''}
                        onChange={(e) => setFormData({ ...formData, car_type_id: e.target.value })}
                        required
                      >
                        <option value="">Select Car Type</option>
                        {carTypes.map(ct => (
                          <option key={ct.id} value={ct.id}>{ct.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Task Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.task_name || ''}
                        onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                        placeholder="e.g., DM OVERHAUL LINEAR BEARING"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="e.g., OVERHAUL 24 LINER BEARINGS"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sort Order</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.sort_order || 0}
                        onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
