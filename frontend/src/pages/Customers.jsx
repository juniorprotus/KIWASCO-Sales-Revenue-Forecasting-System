import { useEffect, useState } from 'react'
import { customersApi, zonesApi } from '../api/client'
import { Users, AlertTriangle, Filter, Search, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => n >= 1e6 ? `KES ${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `KES ${(n/1e3).toFixed(1)}K` : `KES ${n?.toFixed(0)}`

export default function Customers() {
  const [zones, setZones]             = useState([])
  const [customers, setCustomers]     = useState([])
  const [defaulters, setDefaulters]   = useState([])
  const [counts, setCounts]           = useState({ total: 0, active: 0 })
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('list') // list | defaulters
  const [filters, setFilters]         = useState({ zone_id: '', customer_type: '', search: '' })

  useEffect(() => {
    Promise.all([
      zonesApi.list(),
      customersApi.list({ limit: 100 }),
      customersApi.count(),
      customersApi.defaulters(),
    ]).then(([z, c, cnt, d]) => {
      setZones(z.data)
      setCustomers(c.data)
      setCounts(cnt.data)
      setDefaulters(d.data)
      setLoading(false)
    }).catch(() => { toast.error('Failed to load customers'); setLoading(false) })
  }, [])

  const applyFilters = async () => {
    try {
      const params = { limit: 100 }
      if (filters.zone_id) params.zone_id = filters.zone_id
      if (filters.customer_type) params.customer_type = filters.customer_type
      const res = await customersApi.list(params)
      setCustomers(res.data)
      const cnt = await customersApi.count(filters.zone_id || undefined)
      setCounts(cnt.data)
    } catch { toast.error('Filter failed') }
  }

  const loadDefaulters = async () => {
    try {
      const res = await customersApi.defaulters(filters.zone_id || undefined)
      setDefaulters(res.data)
    } catch { toast.error('Failed to load defaulters') }
  }

  useEffect(() => {
    if (tab === 'defaulters') loadDefaulters()
    else applyFilters()
  }, [filters.zone_id, filters.customer_type, tab])

  const zoneName = (id) => zones.find(z => z.id === id)?.name || `Zone ${id}`

  // Filter customers by search
  const filtered = customers.filter(c =>
    !filters.search || c.name.toLowerCase().includes(filters.search.toLowerCase()) ||
    c.account_no.toLowerCase().includes(filters.search.toLowerCase())
  )

  if (loading) return (
    <div className="loading-full">
      <div className="spinner" style={{ borderTopColor: '#0ea5e9', width: 28, height: 28 }} />
      Loading customers…
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">Customer Analytics</div>
          <div className="page-header-sub">Customer records, defaulter tracking, and payment behavior analysis</div>
        </div>
      </div>

      <div className="page-content">
        {/* Summary Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <div className="stat-card purple fade-up">
            <div className="stat-card-header">
              <span className="stat-card-label">Total Customers</span>
              <div className="stat-card-icon purple"><Users size={18} /></div>
            </div>
            <div className="stat-card-value">{counts.total?.toLocaleString()}</div>
          </div>
          <div className="stat-card green fade-up">
            <div className="stat-card-header">
              <span className="stat-card-label">Active</span>
              <div className="stat-card-icon green"><UserCheck size={18} /></div>
            </div>
            <div className="stat-card-value">{counts.active?.toLocaleString()}</div>
          </div>
          <div className="stat-card red fade-up">
            <div className="stat-card-header">
              <span className="stat-card-label">Inactive</span>
              <div className="stat-card-icon red"><UserX size={18} /></div>
            </div>
            <div className="stat-card-value">{(counts.total - counts.active)?.toLocaleString()}</div>
          </div>
          <div className="stat-card amber fade-up">
            <div className="stat-card-header">
              <span className="stat-card-label">Defaulters</span>
              <div className="stat-card-icon amber"><AlertTriangle size={18} /></div>
            </div>
            <div className="stat-card-value">{defaulters.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ maxWidth: 360, marginBottom: 20 }}>
          <button className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
            <Users size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> All Customers
          </button>
          <button className={`tab-btn ${tab === 'defaulters' ? 'active' : ''}`} onClick={() => setTab('defaulters')}>
            <AlertTriangle size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Defaulters
          </button>
        </div>

        {/* Filters */}
        <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', padding: '16px 20px' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Zone</label>
            <select className="form-select" style={{ padding: '8px 12px' }}
              value={filters.zone_id} onChange={e => setFilters(f => ({ ...f, zone_id: e.target.value }))}>
              <option value="">All Zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          {tab === 'list' && (
            <>
              <div style={{ minWidth: 140 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Type</label>
                <select className="form-select" style={{ padding: '8px 12px' }}
                  value={filters.customer_type} onChange={e => setFilters(f => ({ ...f, customer_type: e.target.value }))}>
                  <option value="">All Types</option>
                  <option value="domestic">Domestic</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="institutional">Institutional</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Search</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" style={{ padding: '8px 12px 8px 34px' }}
                    placeholder="Search by name or account no…"
                    value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Customer List */}
        {tab === 'list' && (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account No</th>
                    <th>Name</th>
                    <th>Zone</th>
                    <th>Type</th>
                    <th>Meter No</th>
                    <th>Status</th>
                    <th>Connected</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No customers found</td></tr>
                  ) : filtered.map(c => (
                    <tr key={c.id}>
                      <td><code style={{ fontSize: 12, color: 'var(--brand-primary)', background: 'rgba(14,165,233,0.08)', padding: '2px 8px', borderRadius: 4 }}>{c.account_no}</code></td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td style={{ fontSize: 12 }}>{zoneName(c.zone_id)}</td>
                      <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{c.customer_type}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.meter_no}</td>
                      <td>
                        <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {c.connection_date ? new Date(c.connection_date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Defaulters */}
        {tab === 'defaulters' && (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Account</th>
                    <th>Customer</th>
                    <th>Zone</th>
                    <th>Type</th>
                    <th>Outstanding</th>
                    <th>Unpaid Bills</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {defaulters.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No defaulters found</td></tr>
                  ) : defaulters.map((d, i) => (
                    <tr key={d.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td><code style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: 4 }}>{d.account_no}</code></td>
                      <td style={{ fontWeight: 500 }}>{d.name}</td>
                      <td style={{ fontSize: 12 }}>{zoneName(d.zone_id)}</td>
                      <td><span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{d.customer_type}</span></td>
                      <td style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>{fmt(d.outstanding)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-danger">{d.unpaid_bills}</span>
                      </td>
                      <td>
                        <span className={`badge ${d.outstanding > 50000 ? 'badge-danger' : d.outstanding > 20000 ? 'badge-warning' : 'badge-muted'}`}>
                          {d.outstanding > 50000 ? 'High' : d.outstanding > 20000 ? 'Medium' : 'Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
