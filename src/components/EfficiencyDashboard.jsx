import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { TrendingUp, Users, CheckCircle, Clock, Target, Award, Filter } from 'lucide-react'

function EfficiencyDashboard() {
  const [loading, setLoading] = useState(true)
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
  const [selectedTrain, setSelectedTrain] = useState('all')

  useEffect(() => {
    loadTrains()
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [selectedTimeRange, selectedTrain])

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

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Get all cars with their train unit info
      let carsQuery = supabase
        .from('cars')
        .select('*, train_units(*), car_types(*)')

      const { data: allCars } = await carsQuery

      // Filter cars by selected train
      let filteredCarIds = []
      let filteredCars = allCars || []

      if (selectedTrain !== 'all' && allCars) {
        const trainNum = parseInt(selectedTrain)
        filteredCars = allCars.filter(car => car.train_units?.train_number === trainNum)
        filteredCarIds = filteredCars.map(c => c.id)
      } else if (allCars) {
        filteredCarIds = allCars.map(c => c.id)
      }

      // Get all completions with related data
      let completionsQuery = supabase
        .from('task_completions')
        .select(`
          *,
          teams(*),
          cars(*, train_units(*), car_types(*))
        `)

      const { data: allCompletions } = await completionsQuery

      // Filter completions by selected train
      let completions = allCompletions || []
      if (selectedTrain !== 'all' && allCompletions) {
        completions = allCompletions.filter(c => filteredCarIds.includes(c.car_id))
      }

      if (completions) {
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

        // Calculate team performance
        const teamStats = {}
        completions.forEach(c => {
          if (c.teams) {
            if (!teamStats[c.teams.id]) {
              teamStats[c.teams.id] = {
                name: c.teams.name,
                color: c.teams.color,
                completed: 0,
                inProgress: 0,
                total: 0
              }
            }
            teamStats[c.teams.id].total++
            if (c.status === 'completed') teamStats[c.teams.id].completed++
            if (c.status === 'in_progress') teamStats[c.teams.id].inProgress++
          }
        })

        const teamData = Object.values(teamStats).map(team => ({
          ...team,
          efficiency: team.total > 0 ? Math.round((team.completed / team.total) * 100) : 0
        })).sort((a, b) => b.efficiency - a.efficiency)

        setTeamPerformance(teamData)

        // Calculate unit progress from filtered completions
        const unitStats = {}
        completions.forEach(c => {
          const unitId = c.cars?.train_units?.id
          const unitNumber = c.cars?.train_units?.unit_number
          const trainNumber = c.cars?.train_units?.train_number
          if (unitId) {
            if (!unitStats[unitId]) {
              unitStats[unitId] = {
                name: `T${String(trainNumber).padStart(2, '0')} - ${unitNumber}`,
                unitNumber,
                trainNumber,
                totalTasks: 0,
                completedTasks: 0
              }
            }
            unitStats[unitId].totalTasks++
            if (c.status === 'completed') {
              unitStats[unitId].completedTasks++
            }
          }
        })

        const unitData = Object.values(unitStats).map(unit => ({
          ...unit,
          percent: unit.totalTasks > 0 ? Math.round((unit.completedTasks / unit.totalTasks) * 100) : 0
        })).sort((a, b) => {
          // Sort by train number first, then unit number
          if (a.trainNumber !== b.trainNumber) return a.trainNumber - b.trainNumber
          return a.unitNumber?.localeCompare(b.unitNumber)
        })

        setUnitProgress(unitData)

        // Calculate completions by day (last 14 days)
        const dailyStats = {}
        const now = new Date()
        for (let i = 13; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          dailyStats[dateStr] = { date: dateStr, count: 0 }
        }

        completions.forEach(c => {
          if (c.completed_at) {
            const dateStr = c.completed_at.split('T')[0]
            if (dailyStats[dateStr]) {
              dailyStats[dateStr].count++
            }
          }
        })

        setCompletionsByDay(Object.values(dailyStats).map(d => ({
          ...d,
          displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        })))
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
    setLoading(false)
  }

  const COLORS = ['#10B981', '#F59E0B', '#94a3b8']

  const pieData = [
    { name: 'Completed', value: stats.completedTasks, color: '#10B981' },
    { name: 'In Progress', value: stats.inProgressTasks, color: '#F59E0B' },
    { name: 'Pending', value: stats.pendingTasks, color: '#94a3b8' }
  ].filter(d => d.value > 0)

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading dashboard...
      </div>
    )
  }

  return (
    <div className="efficiency-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Efficiency Dashboard</h1>

        {/* Train Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Filter size={20} style={{ color: 'var(--text-muted)' }} />
          <select
            value={selectedTrain}
            onChange={(e) => setSelectedTrain(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            <option value="all">All Trains (T01-T62)</option>
            {trains.map(train => (
              <option key={train.train_number} value={train.train_number}>
                T{String(train.train_number).padStart(2, '0')}
              </option>
            ))}
          </select>
          {selectedTrain !== 'all' && (
            <button
              onClick={() => setSelectedTrain('all')}
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

      {/* Filter indicator */}
      {selectedTrain !== 'all' && (
        <div style={{
          background: 'var(--accent)',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          display: 'inline-block',
          fontSize: '0.875rem'
        }}>
          Showing data for Train T{String(selectedTrain).padStart(2, '0')} only
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
            <h3 className="chart-title">Daily Completions (Last 14 Days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={completionsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
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

      {/* Unit Progress */}
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">
            {selectedTrain === 'all'
              ? `Progress by Train Unit (Top 20 of ${unitProgress.length})`
              : `Progress by Unit - T${String(selectedTrain).padStart(2, '0')}`}
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={selectedTrain === 'all' ? 500 : 300}>
          <BarChart data={selectedTrain === 'all' ? unitProgress.slice(0, 20) : unitProgress} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={100} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px'
              }}
              formatter={(value) => [`${value}%`, 'Completion']}
            />
            <Bar dataKey="percent" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
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
              <th>Tasks Completed</th>
              <th>In Progress</th>
              <th>Total Assigned</th>
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
                <td>{team.completed}</td>
                <td>{team.inProgress}</td>
                <td>{team.total}</td>
                <td className="progress-cell">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${team.efficiency}%`,
                          background: team.efficiency >= 80 ? '#10B981' :
                                     team.efficiency >= 50 ? '#F59E0B' : '#EF4444'
                        }}
                      />
                    </div>
                    <span style={{ minWidth: '40px', textAlign: 'right' }}>{team.efficiency}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {teamPerformance.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                  No team data available. Complete tasks and assign teams to see performance metrics.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
