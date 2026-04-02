import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Sidebar    from './components/Sidebar'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import Forecasting from './pages/Forecasting'
import Billing    from './pages/Billing'
import Customers  from './pages/Customers'
import Reports    from './pages/Reports'
import Zones      from './pages/Zones'

function PrivateLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/forecasting" element={<Forecasting />} />
          <Route path="/billing"    element={<Billing />} />
          <Route path="/customers"  element={<Customers />} />
          <Route path="/zones"      element={<Zones />} />
          <Route path="/reports"    element={<Reports />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="loading-full">
      <div className="spinner" style={{ borderTopColor: '#0ea5e9' }} />
      Loading KIWASCO System…
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*"     element={user ? <PrivateLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
