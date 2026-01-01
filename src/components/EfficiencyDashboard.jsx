import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { TrendingUp, Users, CheckCircle, Clock, Target, Award, Filter, ArrowUpDown, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

const CACHE_KEY = 'train_tracker_dashboard_cache'
const CACHE_TIMESTAMP_KEY = 'train_tracker_dashboard_timestamp'

// Team roster - who belongs to each team
const TEAM_ROSTER = {
  'Team A': ['AS', 'JT', 'CB', 'JD', 'KM', 'CP', 'KA', 'TFOS'],
  'Team B': ['LN', 'NA', 'PS', 'AOO', 'JN', 'DK', 'DH', 'JL'],
  'Team C': ['SC', 'MA', 'CC', 'OM', 'AL', 'VN', 'RN', 'LVN'],
  'Team D': ['SA', 'MR', 'AR', 'DB', 'GT', 'UQ', 'BP', 'RB']
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
  const [selectedTrain, setSelectedTrain] = useState('all')
  const [sortBy, setSortBy] = useState('train') // 'train' or 'completion'
  const [showTeamRoster, setShowTeamRoster] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cacheTimestamp, setCacheTimestamp] = useState(null)
  const [cachedData, setCachedData] = useState(null)

  useEffect(() => {
    loadTrains()
    // Check for cached data on initial load
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    if (cached && timestamp) {
      setCachedData(JSON.parse(cached))
      setCacheTimestamp(new Date(timestamp))
    }
  }, [])

  useEffect(() => {
    loadDashboardData(false) // Use cache if available
  }, [selectedTimeRange, selectedTrain, cachedData])

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

  const handleRefresh = () => {
    setIsRefreshing(true)
    setCachedData(null)
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    loadDashboardData(true)
  }

  const loadDashboardData = async (forceRefresh = false) => {
    setLoading(true)
    setLoadingProgress('Starting data load...')
    try {
      let allCars, allCompletions

      // Check if we can use cached data
      if (!forceRefresh && cachedData) {
        setLoadingProgress('Using cached data...')
        allCars = cachedData.cars
        allCompletions = cachedData.completions
      } else {
        // Get all cars with their train unit info (with pagination)
        setLoadingProgress('Loading cars from server...')
        allCars = await fetchAllData('cars', '*, train_units(*), car_types(*)')

        // Get all completions with pagination
        setLoadingProgress('Loading task completions from server...')
        allCompletions = await fetchAllData('task_completions', `
          *,
          teams(*),
          cars(*, train_units(*), car_types(*))
        `)

        // Cache the data
        const cacheData = { cars: allCars, completions: allCompletions }
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
          localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString())
          setCachedData(cacheData)
          setCacheTimestamp(new Date())
        } catch (e) {
          console.warn('Could not cache data to localStorage:', e)
        }
      }

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

      // Filter completions by selected train
      let completions = allCompletions || []
      if (selectedTrain !== 'all' && allCompletions) {
        completions = allCompletions.filter(c => filteredCarIds.includes(c.car_id))
      }

      setLoadingProgress('Processing data...')
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
            // Rename "Night Shift" to "Team D"
            const teamName = c.teams.name === 'Night Shift' ? 'Team D' : c.teams.name
            if (!teamStats[c.teams.id]) {
              teamStats[c.teams.id] = {
                name: teamName,
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

        // Sort by number of completed tasks (descending) for ranking
        const teamData = Object.values(teamStats).map(team => ({
          ...team,
          efficiency: team.total > 0 ? Math.round((team.completed / team.total) * 100) : 0
        })).sort((a, b) => b.completed - a.completed)

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

        completions.forEach(c => {
          if (c.completed_at) {
            const dateStr = c.completed_at.split('T')[0]
            // Validate date - must be a valid format YYYY-MM-DD
            if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              if (!dailyStats[dateStr]) {
                dailyStats[dateStr] = { date: dateStr, count: 0 }
              }
              dailyStats[dateStr].count++
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
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
    setLoading(false)
    setIsRefreshing(false)
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

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--accent)',
              color: 'white',
              fontSize: '0.9rem',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isRefreshing ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>

          {/* Train Filter */}
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
            {selectedTrain === 'all'
              ? `Progress by Train (${unitProgress.length} trains)`
              : `Progress - T${String(selectedTrain).padStart(2, '0')}`}
          </h3>
          {selectedTrain === 'all' && (
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
        <ResponsiveContainer width="100%" height={selectedTrain === 'all' ? Math.max(800, sortedUnitProgress.length * 25) : 300}>
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
                         teamName === 'Team C' ? '#F59E0B' : '#8B5CF6',
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
