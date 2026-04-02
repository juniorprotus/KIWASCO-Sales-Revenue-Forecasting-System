import { useEffect, useState } from 'react'
import { reportsApi, zonesApi } from '../api/client'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { FileBarChart2, Download, Calendar, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => n >= 1e6 ? `KES ${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `KES ${(n/1e3).toFixed(1)}K` : `KES ${n?.toFixed(0)}`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e2433', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px', fontSize: 12 }}>
      <p style={{ color: '#94a3b8', marginBottom: 8 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '3px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? (p.value > 1000 ? fmt(p.value) : p.value.toFixed(1)) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Reports() {
  const [zones, setZones]       = useState([])
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [year, setYear]         = useState(new Date().getFullYear())
  const [zoneId, setZoneId]     = useState('')
  const [downloading, setDown]  = useState(false)

  const loadData = async (yr, zId) => {
    try {
      const res = await reportsApi.summary(yr, zId || undefined)
      setData(res.data)
    } catch { toast.error('Failed to load report data') }
    setLoading(false)
  }

  useEffect(() => {
    zonesApi.list().then(r => setZones(r.data)).catch(() => {})
    loadData(year, zoneId)
  }, [])

  useEffect(() => { loadData(year, zoneId) }, [year, zoneId])

  const handleDownload = async () => {
    setDown(true)
    try {
      const res = await reportsApi.downloadXlsx(year, zoneId || undefined)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `KIWASCO_Report_${year}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Report downloaded successfully!')
    } catch {
      toast.error('Download failed')
    } finally {
      setDown(false)
    }
  }

  // Totals
  const totals = data.reduce((a, r) => ({
    billed: a.billed + r.billed,
    collected: a.collected + r.collected,
    consumption: a.consumption + r.consumption_m3,
    nrw: a.nrw + r.nrw_m3,
  }), { billed: 0, collected: 0, consumption: 0, nrw: 0 })

  if (loading) return (
    <div className="loading-full">
      <div className="spinner" style={{ borderTopColor: '#0ea5e9', width: 28, height: 28 }} />
      Loading report…
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">Reports &amp; Export</div>
          <div className="page-header-sub">Annual revenue reports with Excel export for management meetings</div>
        </div>
        <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          {downloading ? <><div className="spinner" /> Generating…</> : <><Download size={15} /> Export to Excel</>}
        </button>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24, padding: '16px 20px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 140 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>
              <Calendar size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
              Year
            </label>
            <select className="form-select" style={{ padding: '8px 12px' }}
              value={year} onChange={e => setYear(+e.target.value)}>
              {[2022, 2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>
              <Filter size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
              Zone
            </label>
            <select className="form-select" style={{ padding: '8px 12px' }}
              value={zoneId} onChange={e => setZoneId(e.target.value)}>
              <option value="">All Zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Annual Revenue</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0ea5e9', fontFamily: 'Space Grotesk' }}>
                {fmt(totals.collected)}
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: 'var(--border-subtle)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Collection Rate</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', fontFamily: 'Space Grotesk' }}>
                {totals.billed ? ((totals.collected / totals.billed) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="chart-container">
            <div className="chart-title">Monthly Revenue — {year}</div>
            <div className="chart-sub">Billed vs Collected (KES)</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={m => m?.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${(v/1e6).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="billed"    name="Billed"    fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.5} />
                <Bar dataKey="collected" name="Collected" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <div className="chart-title">Collection Rate Trend — {year}</div>
            <div className="chart-sub">Monthly collection efficiency (%)</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={m => m?.slice(0, 3)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="collection_rate" name="Collection Rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data Table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="chart-title">Monthly Breakdown — {year}</div>
            <span className="badge badge-info">
              {zoneId ? zones.find(z => z.id == zoneId)?.name : 'All Zones'}
            </span>
          </div>
          <div className="table-wrap" style={{ margin: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Billed (KES)</th>
                  <th>Collected (KES)</th>
                  <th>Collection Rate</th>
                  <th>Consumption (m³)</th>
                  <th>NRW Loss (m³)</th>
                  <th>Bills</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.month}</td>
                    <td>{fmt(r.billed)}</td>
                    <td style={{ color: '#0ea5e9', fontWeight: 600 }}>{fmt(r.collected)}</td>
                    <td>
                      <span className={`badge ${r.collection_rate >= 80 ? 'badge-success' : r.collection_rate >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                        {r.collection_rate}%
                      </span>
                    </td>
                    <td>{r.consumption_m3?.toLocaleString()}</td>
                    <td style={{ color: '#ef4444' }}>{r.nrw_m3?.toLocaleString()}</td>
                    <td>{r.bill_count?.toLocaleString()}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: 'rgba(14,165,233,0.05)', fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td>{fmt(totals.billed)}</td>
                  <td style={{ color: '#0ea5e9' }}>{fmt(totals.collected)}</td>
                  <td>
                    <span className="badge badge-info">
                      {totals.billed ? ((totals.collected / totals.billed) * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                  <td>{totals.consumption?.toLocaleString()}</td>
                  <td style={{ color: '#ef4444' }}>{totals.nrw?.toLocaleString()}</td>
                  <td>{data.reduce((a, r) => a + (r.bill_count || 0), 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
