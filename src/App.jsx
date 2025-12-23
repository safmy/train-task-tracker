import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Train, BarChart3, Settings, ClipboardList } from 'lucide-react'
import TaskTracker from './components/TaskTracker'
import EfficiencyDashboard from './components/EfficiencyDashboard'
import AdminPanel from './components/AdminPanel'
import './App.css'

function App() {
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
