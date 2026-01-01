import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Train, BarChart3, Settings, ClipboardList, RefreshCw } from 'lucide-react'
import TaskTracker from './components/TaskTracker'
import EfficiencyDashboard from './components/EfficiencyDashboard'
import AdminPanel from './components/AdminPanel'
import './App.css'

function App() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    // Dispatch custom event for dashboard to listen to
    window.dispatchEvent(new CustomEvent('refreshDashboardData'))
    // Reset after animation
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <Train size={28} />
            <span>Train Task Tracker</span>
          </div>
          <div className="nav-links">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <ClipboardList size={20} />
              <span>Task Tracker</span>
            </NavLink>
            <NavLink to="/efficiency" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <BarChart3 size={20} />
              <span>Efficiency</span>
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Settings size={20} />
              <span>Admin</span>
            </NavLink>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="nav-link refresh-btn"
              style={{
                background: 'var(--accent)',
                border: 'none',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.7 : 1,
              }}
              title="Refresh data from server"
            >
              <RefreshCw size={20} className={isRefreshing ? 'spinning' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<TaskTracker />} />
            <Route path="/efficiency" element={<EfficiencyDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
