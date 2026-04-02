import { useEffect, useState } from 'react'
import { dashboardApi, billsApi, zonesApi } from '../api/client'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  Users, Banknote, TrendingUp, Droplets, AlertTriangle,
  MapPin, Receipt, RefreshCw, Bell, CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => n >= 1e6
  ? `KES ${(n/1e6).toFixed(2)}M`
  : n >= 1e3 ? `KES ${(n/1e3).toFixed(1)}K` : `KES ${n?.toFixed(0)}`

const ZONE_COLORS = ['#0ea5e9','#22d3ee','#10b981','#6366f1','#f59e0b','#8b5cf6','#ef4444']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:'#1e2433', border:'1px solid #334155',
      borderRadius:10, padding:'12px 16px', fontSize:12
    }}>
      <p style={{ color:'#94a3b8', marginBottom:8 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color: p.color, margin:'3px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? (p.value > 1000 ? fmt(p.value) : p.value.toFixed(1)) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary]     = useState(null)
  const [kpiCards, setKpiCards]   = useState([])
  const [trend, setTrend]         = useState([])
  const [alerts, setAlerts]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const [s, k, t, a] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.kpiCards(),
        billsApi.monthlyTrend(),
        dashboardApi.alerts(),
      ])
      setSummary(s.data)
      setKpiCards(k.data)
      setTrend(t.data.slice(-12))
      setAlerts(a.data.filter(x => !x.is_read))
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const refresh = () => { setRefreshing(true); load() }

  const dismissAlert = async (id) => {
    await dashboardApi.markRead(id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  if (loading) return (
    <div className="loading-full">
      <div className="spinner" style={{ borderTopColor:'#0ea5e9', width:28, height:28 }} />
      Loading dashboard…
    </div>
  )

  const statCards = [
    { label:'Total Revenue', value: fmt(summary?.total_revenue_this_month||0), icon: Banknote, color:'blue',
      change: `${summary?.revenue_change_pct >= 0 ? '+' : ''}${summary?.revenue_change_pct?.toFixed(1)}% vs last month`,
      trend: summary?.revenue_change_pct >= 0 ? 'up' : 'down' },
    { label:'Collection Rate', value: `${summary?.collection_rate||0}%`, icon: TrendingUp, color:'green',
      change: 'Bills collected on time' },
    { label:'Active Customers', value: (summary?.active_customers||0).toLocaleString(), icon: Users, color:'purple',
      change: `of ${(summary?.total_customers||0).toLocaleString()} total` },
    { label:'NRW Loss', value: `${summary?.nrw_percentage||0}%`, icon: Droplets, color:'amber',
      change: `${fmt(summary?.total_nrw_this_month||0)} lost this month` },
    { label:'Unpaid Bills', value: (summary?.unpaid_bills||0).toLocaleString(), icon: Receipt, color:'red',
      change: 'Requires collection action' },
    { label:'Active Zones', value: summary?.total_zones||0, icon: MapPin, color:'cyan',
      change: 'KIWASCO service areas' },
  ]

  // Pie data from zone cards
  const pieData = kpiCards.slice(0,7).map((z,i) => ({
    name: z.zone_name.split(' ')[0], value: z.collected, color: ZONE_COLORS[i]
  }))

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-header-title">Executive Dashboard</div>
          <div className="page-header-sub">Real-time KIWASCO performance overview · {new Date().toLocaleDateString('en-KE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {alerts.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
              background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
              borderRadius:8, fontSize:12, color:'#ef4444' }}>
              <Bell size={14} /> {alerts.length} Alert{alerts.length>1?'s':''}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* KPI Stats */}
        <div className="stats-grid">
          {statCards.map((s,i) => (
            <div key={i} className={`stat-card ${s.color} fade-up`}>
              <div className="stat-card-header">
                <span className="stat-card-label">{s.label}</span>
                <div className={`stat-card-icon ${s.color}`}><s.icon size={18} /></div>
              </div>
              <div className="stat-card-value">{s.value}</div>
              <div className={`stat-card-change ${s.trend||''}`}>{s.change}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid-2" style={{ marginBottom:24 }}>
          {/* Revenue Trend */}
          <div className="chart-container">
            <div className="chart-title">Revenue Trend — Last 12 Months</div>
            <div className="chart-sub">Billed vs Collected (KES)</div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trend} margin={{ top:5, right:5, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="gBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#64748b' }} />
                <YAxis tick={{ fontSize:11, fill:'#64748b' }} tickFormatter={v => `${(v/1e6).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:12 }} />
                <Area type="monotone" dataKey="billed"    name="Billed"    stroke="#6366f1" fill="url(#gBilled)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#0ea5e9" fill="url(#gCollected)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Zone Revenue Pie */}
          <div className="chart-container">
            <div className="chart-title">Revenue Distribution by Zone</div>
            <div className="chart-sub">Current month collections</div>
            <div style={{ display:'flex', alignItems:'center', gap:20 }}>
              <ResponsiveContainer width={180} height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                    paddingAngle={3} dataKey="value" stroke="none">
                    {pieData.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1 }}>
                {pieData.map((z,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:z.color, flexShrink:0 }} />
                      <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{z.name}</span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{fmt(z.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Zone Performance Table + Alerts */}
        <div className="grid-2">
          {/* Zone cards */}
          <div className="card">
            <div className="chart-title" style={{ marginBottom:16 }}>Zone Performance — This Month</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Collected</th>
                    <th>Target %</th>
                    <th>NRW</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiCards.map((z,i) => (
                    <tr key={i}>
                      <td><strong style={{ fontSize:13 }}>{z.zone_name}</strong></td>
                      <td style={{ fontSize:13, fontWeight:600, color:'#0ea5e9' }}>{fmt(z.collected)}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="progress-bar-wrap">
                            <div className="progress-bar-fill" style={{
                              width:`${Math.min(z.target_pct,100)}%`,
                              background: z.target_pct>=80 ? '#10b981' : z.target_pct>=50 ? '#f59e0b' : '#ef4444'
                            }}/>
                          </div>
                          <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:36 }}>{z.target_pct}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize:12 }}>{z.nrw?.toFixed(0)} m³</td>
                      <td>
                        <span className={`badge ${z.collection_rate>=80?'badge-success':z.collection_rate>=60?'badge-warning':'badge-danger'}`}>
                          {z.collection_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div className="chart-title">System Alerts</div>
              <span className="badge badge-danger">{alerts.length} Active</span>
            </div>
            {alerts.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
                <CheckCircle size={32} style={{ margin:'0 auto 10px', color:'#10b981' }} />
                <p>All alerts resolved</p>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className={`alert-item ${a.severity}`}>
                <div className={`alert-dot ${a.severity}`} />
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.5 }}>{a.message}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, textTransform:'capitalize' }}>
                    {a.threshold_type?.replace(/_/g,' ')} · {a.severity}
                  </p>
                </div>
                <button onClick={() => dismissAlert(a.id)}
                  style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Consumption Bar Chart */}
        <div className="chart-container" style={{ marginTop:24 }}>
          <div className="chart-title">Monthly Water Consumption & NRW Losses</div>
          <div className="chart-sub">Cubic meters consumed vs non-revenue water loss</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top:5, right:10, left:0, bottom:0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize:11, fill:'#64748b' }} />
              <YAxis tick={{ fontSize:11, fill:'#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="consumption" name="Consumption (m³)" fill="#0ea5e9" radius={[4,4,0,0]} />
              <Bar dataKey="nrw"         name="NRW Loss (m³)"    fill="#ef4444" radius={[4,4,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
