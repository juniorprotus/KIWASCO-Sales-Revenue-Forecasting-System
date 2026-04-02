import { useEffect, useState } from 'react'
import { zonesApi } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { MapPin, Users, BarChart3, Droplets, Target } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => n >= 1e6 ? `KES ${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `KES ${(n/1e3).toFixed(1)}K` : `KES ${n?.toFixed(0)}`
const COLORS = ['#0ea5e9', '#22d3ee', '#10b981', '#6366f1', '#f59e0b', '#8b5cf6', '#ef4444']

export default function Zones() {
  const [zones, setZones]       = useState([])
  const [selected, setSelected] = useState(null)
  const [stats, setStats]       = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    zonesApi.list().then(r => {
      setZones(r.data)
      if (r.data.length) selectZone(r.data[0].id)
      setLoading(false)
    }).catch(() => { toast.error('Failed to load zones'); setLoading(false) })
  }, [])

  const selectZone = async (id) => {
    setSelected(id)
    try {
      const res = await zonesApi.stats(id)
      setStats(res.data)
    } catch { toast.error('Failed to load zone stats') }
  }

  // Radar data
  const radarData = zones.map(z => ({
    zone: z.name.split(' ')[0],
    population: z.population / 1000,
    area: z.area_sqkm,
    target: z.target_monthly_revenue / 100000,
  }))

  // Population bar chart
  const popData = zones.map((z, i) => ({
    name: z.name.split(' ')[0],
    population: z.population,
    color: COLORS[i],
  }))

  if (loading) return (
    <div className="loading-full">
      <div className="spinner" style={{ borderTopColor: '#0ea5e9', width: 28, height: 28 }} />
      Loading zones…
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">KIWASCO Service Zones</div>
          <div className="page-header-sub">Zone profiles, demographics, and current month performance</div>
        </div>
      </div>

      <div className="page-content">
        {/* Zone Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
          {zones.map((z, i) => (
            <div
              key={z.id}
              className={`zone-card fade-up ${selected === z.id ? 'selected' : ''}`}
              onClick={() => selectZone(z.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `${COLORS[i]}20`, color: COLORS[i],
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MapPin size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{z.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{z.area_sqkm} km²</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <Users size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                  {z.population?.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: COLORS[i] }}>
                  <Target size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                  {fmt(z.target_monthly_revenue)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Zone Details */}
        {stats && (
          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="card">
              <div className="chart-title" style={{ marginBottom: 20 }}>
                {stats.zone?.name} — This Month
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: '14px 16px', background: 'rgba(14,165,233,0.06)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>BILLED</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: '#0ea5e9' }}>
                    {fmt(stats.current_month?.total_billed || 0)}
                  </div>
                </div>
                <div style={{ padding: '14px 16px', background: 'rgba(16,185,129,0.06)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>COLLECTED</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: '#10b981' }}>
                    {fmt(stats.current_month?.total_paid || 0)}
                  </div>
                </div>
                <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.06)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>COLLECTION RATE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: '#f59e0b' }}>
                    {stats.current_month?.collection_rate || 0}%
                  </div>
                </div>
                <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.06)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>NRW LOSS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: '#ef4444' }}>
                    {stats.current_month?.nrw_pct || 0}%
                  </div>
                </div>
              </div>
              {/* Target progress */}
              <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target Achievement</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: stats.target_achievement_pct >= 80 ? '#10b981' : '#f59e0b' }}>
                    {stats.target_achievement_pct}%
                  </span>
                </div>
                <div className="progress-bar-wrap" style={{ height: 8 }}>
                  <div className="progress-bar-fill" style={{
                    width: `${Math.min(stats.target_achievement_pct, 100)}%`,
                    background: stats.target_achievement_pct >= 80
                      ? 'linear-gradient(90deg, #10b981, #0ea5e9)'
                      : stats.target_achievement_pct >= 50
                        ? 'linear-gradient(90deg, #f59e0b, #eab308)'
                        : 'linear-gradient(90deg, #ef4444, #f59e0b)',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Collected: {fmt(stats.current_month?.total_paid || 0)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: {fmt(stats.target_revenue || 0)}</span>
                </div>
              </div>
            </div>

            {/* Zone Overview */}
            <div className="card">
              <div className="chart-title" style={{ marginBottom: 12 }}>Zone Demographics Overview</div>
              <div className="chart-sub">Population density across service areas</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={popData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(v) => [v.toLocaleString(), 'Population']}
                    contentStyle={{ background: '#1e2433', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }}
                  />
                  <Bar dataKey="population" radius={[6, 6, 0, 0]}>
                    {popData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Zone Table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px 0' }}>
            <div className="chart-title">All Service Zones</div>
          </div>
          <div className="table-wrap" style={{ margin: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Population</th>
                  <th>Area (km²)</th>
                  <th>Density</th>
                  <th>Monthly Target</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z, i) => (
                  <tr key={z.id} style={{ cursor: 'pointer' }}
                    onClick={() => selectZone(z.id)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: COLORS[i], boxShadow: `0 0 6px ${COLORS[i]}50`
                        }} />
                        <strong>{z.name}</strong>
                      </div>
                    </td>
                    <td>{z.population?.toLocaleString()}</td>
                    <td>{z.area_sqkm}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {z.area_sqkm ? (z.population / z.area_sqkm).toFixed(0) : '—'} /km²
                    </td>
                    <td style={{ fontWeight: 600, color: '#0ea5e9' }}>{fmt(z.target_monthly_revenue)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {z.created_at ? new Date(z.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'short' }) : '—'}
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
