import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/client'

const AuthContext = createContext(null)

// Role permission map
const ROLE_PERMISSIONS = {
  admin:           ['dashboard','forecasting','billing','customers','zones','reports','tickets','anomalies','data_quality','audit','register'],
  superadmin:      ['dashboard','forecasting','billing','customers','zones','reports','tickets','anomalies','data_quality','audit','register'],
  analyst:         ['dashboard','forecasting','billing','customers','zones','reports','tickets','anomalies','data_quality'],
  data_steward:    ['dashboard','data_quality','forecasting','reports'],
  revenue_officer: ['dashboard','anomalies','billing','reports'],
  field_officer:   ['dashboard','tickets'],
  viewer:          ['dashboard','forecasting','billing','customers','zones','reports'],
  auditor:         ['dashboard','audit','reports'],
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('kiwasco_user')
    const token  = localStorage.getItem('kiwasco_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const res = await authApi.login(username, password)
    localStorage.setItem('kiwasco_token', res.data.access_token)
    localStorage.setItem('kiwasco_user',  JSON.stringify(res.data.user))
    setUser(res.data.user)
    return res.data.user
  }

  const logout = () => {
    localStorage.removeItem('kiwasco_token')
    localStorage.removeItem('kiwasco_user')
    setUser(null)
  }

  const hasAccess = (section) => {
    if (!user?.role) return false
    const perms = ROLE_PERMISSIONS[user.role] || []
    return perms.includes(section)
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const roleLabel = (role) => {
    const labels = {
      admin: 'System Admin',
      superadmin: 'Super Admin',
      analyst: 'Analyst',
      data_steward: 'Data Steward',
      revenue_officer: 'Revenue Officer',
      field_officer: 'Field Officer',
      viewer: 'Viewer',
      auditor: 'External Auditor',
    }
    return labels[role] || role
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, hasAccess, roleLabel }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
