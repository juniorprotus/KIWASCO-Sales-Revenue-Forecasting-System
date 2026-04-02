import { useEffect, useState } from 'react'
import { billsApi, zonesApi } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line
} from 'recharts'
import { Receipt, Filter, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => n >= 1e6 ? `KES ${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `KES ${(n/1e3).toFixed(1)}K` : `KES ${n?.toFixed(0)}`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#1e2433', border:'1px solid #334155', borderRadius:10, padding:'12px 16px', fontSize:12 }}>
      <p style={{ color:'#94a3b8', marginBottom:8 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color: p.color, margin:'3px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? fmt(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Billing() {
  const [zones, setZones]       = useState([])
  const [trend, setTrend]       = useState([])
  const [comparison, setComp]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [zoneFilter, setZoneFilter] = useState('')

  useEffect(() => {
    Promise.all([
      zonesApi.list(),
      billsApi.monthlyTrend(),
      billsApi.zoneCompare(),
    ]).then(([z, t, c]) => {
      setZones(z.data)
      setTrend(t.data)
      setComp(c.data)
      setLoading(false)
    }).catch(() => { toast.error('Failed to load billing data'); setLoading(false) })
  }, [])

  const handleZoneChange = async (zoneId) => {
    setZoneFilter(zoneId)
    try {
      const t = await billsApi.monthlyTrend(zoneId || undefined)
      setTrend(t.data)
    } catch { toast.error('Failed to filter') }
  }

  if (loading) return (
    <div className="loading-full">
      <div className="spinner" style={{ borderTopColor:'#0ea5e9', width:28, height:28 }} />
      Loading billing data…
    </div>
  )

  const totals = comparison.reduce((a, z) => ({
    billed: a.billed + z.billed,
    collected: a.collected + z.collected,
    nrw: a.nrw + z.nrw,
  }), { billed:0, collected:0, nrw:0 })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">Billing &amp; Revenue</div>
          <div className="page-header-sub">Monthly billing analytics, collection tracking, and zone revenue comparison</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Filter size={14} color="var(--text-muted)" />
          <select className="form-select" value={zoneFilter}
            onChange={e => handleZoneChange(e.target.value)}
            style={{ width:200, padding:'8px 12px', fontSize:13 }}>
            <option value="">All Zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>

      <div className="page-content">
        {/* Summary KPIs */}
        <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3, 1fr)', marginBottom:24 }}>
          <div className="stat-card blue fade-up">
            <div className="stat-card-label">Total Billed</div>
            <div className="stat-card-value">{fmt(totals.billed)}</div>
            <div className="stat-card-change">This month across all zones</div>
          </div>
          <div className="stat-card green fade-up">
            <div className="stat-card-label">Total Collected</div>
            <div className="stat-card-value">{fmt(totals.collected)}</div>
            <div className="stat-card-change">
              Collection rate: {totals.billed ? ((totals.collected/totals.billed)*100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="stat-card red fade-up">
            <div className="stat-card-label">Revenue Gap</div>
            <div className="stat-card-value">{fmt(totals.billed - totals.collected)}</div>
            <div className="stat-card-change">Uncollected this month</div>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="chart-container" style={{ marginBottom:24 }}>
          <div className="chart-title">
            Revenue Collection Trend {zoneFilter ? `— ${zones.find(z=>z.id==zoneFilter)?.name}` : '— All Zones'}
          </div>
          <div className="chart-sub">Billed vs Collected with collection rate overlay</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend.slice(-18)} margin={{ top:5, right:10, left:0, bottom:0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize:11, fill:'#64748b' }} />
              <YAxis yAxisId="left" tick={{ fontSize:11, fill:'#64748b' }} tickFormatter={v => `${(v/1e6).toFixed(1)}M`} />
              <YAxis yAxisId="right" orientation="right" domain={[0,100]} tick={{ fontSize:11, fill:'#64748b' }} tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Bar yAxisId="left" dataKey="billed"    name="Billed (KES)"    fill="#6366f1" radius={[4,4,0,0]} opacity={0.6} />
              <Bar yAxisId="left" dataKey="collected"  name="Collected (KES)" fill="#0ea5e9" radius={[4,4,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="collection_rate" name="Collection %" stroke="#10b981" strokeWidth={2} dot={{ r:3 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Zone Comparison */}
        <div className="card">
          <div className="chart-title" style={{ marginBottom:16 }}>Zone Revenue Comparison — Current Month</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Zone</th>
                  <th>Billed</th>
                  <th>Collected</th>
                  <th>Gap</th>
                  <th>Coll. Rate</th>
                  <th>Target</th>
                  <th>Achievement</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((z, i) => (
                  <tr key={z.zone_id}>
                    <td style={{ color:'var(--text-muted)', fontSize:12 }}>{i+1}</td>
                    <td><strong>{z.zone_name}</strong></td>
                    <td>{fmt(z.billed)}</td>
                    <td style={{ color:'#0ea5e9', fontWeight:600 }}>{fmt(z.collected)}</td>
                    <td style={{ color:'#ef4444' }}>{fmt(z.billed - z.collected)}</td>
                    <td>
                      <span className={`badge ${z.collection_rate >= 80 ? 'badge-success' : z.collection_rate >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                        {z.collection_rate}%
                      </span>
                    </td>
                    <td style={{ color:'var(--text-muted)' }}>{fmt(z.target)}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="progress-bar-wrap">
                          <div className="progress-bar-fill" style={{
                            width: `${Math.min(z.target_pct, 100)}%`,
                            background: z.target_pct >= 80 ? '#10b981' : z.target_pct >= 50 ? '#f59e0b' : '#ef4444'
                          }} />
                        </div>
                        <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:36 }}>{z.target_pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
