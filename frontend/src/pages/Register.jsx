import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/client'
import toast from 'react-hot-toast'
import { Droplets, UserPlus, Mail, Lock, User, Briefcase } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'viewer'
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password || !form.email || !form.full_name) {
      toast.error('Please fill in all required fields')
      return
    }
    setLoading(true)
    try {
      await authApi.register(form)
      toast.success('Registration successful! You can now log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-orb" style={{
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)',
        top: -150, left: -100,
      }}/>
      
      <div className="login-card fade-up" style={{ maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 24px rgba(14,165,233,0.2)',
          }}>
            <Droplets size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Create Account</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Join the KIWASCO Forecasting Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" style={{ paddingLeft: 38 }}
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="John Doe" />
                <User size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" style={{ paddingLeft: 38 }}
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="jdoe" />
                <User size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type="email" style={{ paddingLeft: 38 }}
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="johndoe@kiwasco.co.ke" />
              <Mail size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type="password" style={{ paddingLeft: 38 }}
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" />
              <Lock size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Desired Role</label>
            <div style={{ position: 'relative' }}>
              <select className="form-select" style={{ paddingLeft: 38 }}
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="viewer">Management Viewer</option>
                <option value="analyst">Data Analyst</option>
                <option value="admin">System Administrator</option>
              </select>
              <Briefcase size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 44 }} disabled={loading}>
            {loading ? <div className="spinner" /> : <><UserPlus size={16} /> Register Now</>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  )
}
