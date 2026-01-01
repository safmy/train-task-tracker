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

      // Filter cars by selected train
      let filteredCarIds = []
      let filteredCars = allCars

      if (selectedTrain !== 'all') {
        const trainNum = parseInt(selectedTrain)
        filteredCars = allCars.filter(car => car.train_units?.train_number === trainNum)
        filteredCarIds = filteredCars.map(c => c.id)
      } else {
        filteredCarIds = allCars.map(c => c.id)
      }

      // Filter completions by selected train
      let completions = allCompletions
      if (selectedTrain !== 'all') {
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
        teamStats[teamKey].totalMinutes += taskMinutes

        if (c.status === 'completed') {
          teamStats[teamKey].completed++
          teamStats[teamKey].completedMinutes += taskMinutes

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
    const teamData = Object.entries(teamStats).map(([teamKey, team]) => {
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
      processCompletionsData(completions)
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

        {/* Train Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          <strong>Efficiency Formula:</strong> Task Hours ÷ Available Hours (8h × Person-Days)
          <br />
          <em>Example: If AS works 3 days and completes 21 hours of tasks, efficiency = 21h ÷ (8h × 3) = 87.5%</em>
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
