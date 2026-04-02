import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, TrendingUp, Receipt, Users,
  MapPin, FileBarChart2, LogOut, Droplets
} from 'lucide-react'

const NAV = [
  { label: 'Overview', items: [
    { to: '/',            icon: LayoutDashboard, label: 'Dashboard'    },
    { to: '/forecasting', icon: TrendingUp,      label: 'Forecasting'  },
  ]},
  { label: 'Operations', items: [
    { to: '/billing',     icon: Receipt,         label: 'Billing'      },
    { to: '/customers',   icon: Users,           label: 'Customers'    },
    { to: '/zones',       icon: MapPin,          label: 'Zones'        },
  ]},
  { label: 'Analytics', items: [
    { to: '/reports',     icon: FileBarChart2,   label: 'Reports'      },
  ]},
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : (user?.username || 'U').slice(0,2).toUpperCase()

  return (
    <aside className="app-sidebar">
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
        {NAV.map(section => (
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
            <div className="user-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.full_name || user?.username}
            </div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px' }}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
