import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Droplets, Eye, EyeOff, LogIn } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [form, setForm]       = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) { toast.error('Please fill in all fields'); return }
    setLoading(true)
    try {
      await login(form.username, form.password)
      toast.success('Welcome to KIWASCO System!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (role) => {
    const creds = {
      admin:   { username: 'admin',   password: 'admin1234'   },
      analyst: { username: 'analyst', password: 'analyst1234' },
      viewer:  { username: 'viewer',  password: 'viewer1234'  },
    }
    setForm(creds[role])
  }

  return (
    <div className="login-page">
      {/* Background orbs */}
      <div className="login-bg-orb" style={{
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)',
        top: -150, left: -100,
      }}/>
      <div className="login-bg-orb" style={{
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
        bottom: -100, right: -80,
      }}/>

      <div className="login-card fade-up">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 32px rgba(14,165,233,0.3)',
          }}>
            <Droplets size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>KIWASCO</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Sales &amp; Revenue Forecasting System<br/>
            <span style={{ fontSize: 11 }}>Kisumu Water &amp; Sewerage Company</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              placeholder="Enter your username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ paddingRight: 44 }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <div className="spinner" /> : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>

        {/* Demo accounts */}
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Demo Accounts
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['admin', 'analyst', 'viewer'].map(role => (
              <button
                key={role}
                type="button"
                onClick={() => fillDemo(role)}
                className="btn btn-ghost btn-sm"
                style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
