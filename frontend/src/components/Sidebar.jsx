import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, TrendingUp, Receipt, Users, MapPin,
  FileBarChart2, AlertTriangle, DollarSign, Database, Shield,
  LogOut, Droplets, Menu, X
} from 'lucide-react'

const NAV_SECTIONS = [
  { label: 'Overview', items: [
    { to: '/',            icon: LayoutDashboard, label: 'Dashboard',         access: 'dashboard'   },
    { to: '/forecasting', icon: TrendingUp,      label: 'Forecasting',       access: 'forecasting' },
  ]},
  { label: 'Operations', items: [
    { to: '/billing',     icon: Receipt,         label: 'Billing',           access: 'billing'     },
    { to: '/customers',   icon: Users,           label: 'Customers',         access: 'customers'   },
    { to: '/zones',       icon: MapPin,          label: 'Zones',             access: 'zones'       },
  ]},
  { label: 'Field & Revenue', items: [
    { to: '/tickets',     icon: AlertTriangle,   label: 'NRW Tickets',       access: 'tickets'     },
    { to: '/anomalies',   icon: DollarSign,      label: 'Revenue Anomalies', access: 'anomalies'   },
  ]},
  { label: 'Data & Compliance', items: [
    { to: '/data-quality', icon: Database,       label: 'Data Quality',      access: 'data_quality'},
    { to: '/audit',        icon: Shield,         label: 'Audit Log',         access: 'audit'       },
  ]},
  { label: 'Analytics', items: [
    { to: '/reports',     icon: FileBarChart2,   label: 'Reports',           access: 'reports'     },
  ]},
]

export default function Sidebar() {
  const { user, logout, hasAccess, roleLabel } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  /* Close mobile sidebar on route change */
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  /* Prevent body scroll when mobile sidebar is open */
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.username || 'U').slice(0, 2).toUpperCase()

  /* Filter sections: only show sections where at least one item is accessible */
  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => hasAccess(item.access)),
    }))
    .filter(section => section.items.length > 0)

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        className={`mobile-menu-btn${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Overlay — mobile only */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Droplets size={22} color="white" />
          </div>
          <div className="sidebar-logo-title">KIWASCO</div>
          <div className="sidebar-logo-sub">FORECASTING SYSTEM</div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {visibleSections.map(section => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <item.icon className="nav-icon" size={17} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || user?.username}
              </div>
              <div className="user-role">{roleLabel(user?.role)}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
