import { useEffect, useState } from 'react'
import { zonesApi, forecastsApi } from '../api/client'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'
import {
  TrendingUp, Play, MapPin, BarChart3, Droplets,
  AlertTriangle, DollarSign, Percent
} from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n?.toFixed(0)

const METRICS = [
  { key: 'revenue',      label: 'Revenue Forecast',     icon: DollarSign, unit: 'KES',  color: '#0ea5e9' },
  { key: 'consumption',  label: 'Demand Forecast',      icon: Droplets,   unit: 'm³',   color: '#10b981' },
  { key: 'default_rate', label: 'Default Rate Forecast', icon: Percent,    unit: '%',    color: '#f59e0b' },
  { key: 'nrw',          label: 'NRW Loss Forecast',    icon: AlertTriangle, unit: 'm³', color: '#ef4444' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e2433', border: '1px solid #334155',
      borderRadius: 10, padding: '12px 16px', fontSize: 12
    }}>
      <p style={{ color: '#94a3b8', marginBottom: 8 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '3px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? fmt(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Forecasting() {
  const [zones, setZones]     = useState([])
  const [selZone, setSelZone] = useState(null)
  const [metric, setMetric]   = useState('revenue')
  const [periods, setPeriods] = useState(6)
  const [result, setResult]   = useState(null)
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    zonesApi.list().then(r => {
      setZones(r.data)
      if (r.data.length) setSelZone(r.data[0].id)
      setLoading(false)
    }).catch(() => { toast.error('Failed to load zones'); setLoading(false) })
  }, [])

  const runForecast = async () => {
    if (!selZone) return toast.error('Select a zone first')
    setRunning(true)
    try {
      const res = await forecastsApi.run({ zone_id: selZone, periods, forecast_type: metric })
      setResult(res.data)
      toast.success(`Forecast complete — MAE: ${res.data.mae?.toFixed(2) || 'N/A'}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Forecast failed')
    } finally {
      setRunning(false)
    }
  }

  // Merge historical + forecast for the chart
  const chartData = (() => {
    if (!result) return []
    const hist = (result.historical || []).map(h => ({
      ds: h.ds, actual: h.actual, predicted: h.yhat, type: 'historical'
    }))
    const fc = (result.forecast || []).map(f => ({
      ds: typeof f.forecast_month === 'string' ? f.forecast_month : f.forecast_month,
      predicted: f.predicted, lower: f.lower_bound, upper: f.upper_bound, type: 'forecast'
    }))
    return [...hist, ...fc]
  })()

  const selMetric = METRICS.find(m => m.key === metric)

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
          <div className="page-header-title">AI Forecasting Engine</div>
          <div className="page-header-sub">Prophet-powered predictions for KIWASCO revenue, demand, defaults &amp; NRW</div>
        </div>
      </div>

      <div className="page-content">
        {/* Metric Tabs */}
        <div className="tabs" style={{ maxWidth: 680 }}>
          {METRICS.map(m => (
            <button
              key={m.key}
              className={`tab-btn ${metric === m.key ? 'active' : ''}`}
              onClick={() => { setMetric(m.key); setResult(null) }}
            >
              <m.icon size={14} style={{ marginRight: 5, verticalAlign: -2 }} />
              {m.label.replace(' Forecast', '')}
            </button>
          ))}
        </div>

        {/* Config Row */}
        <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label className="form-label">Service Zone</label>
            <select className="form-select" value={selZone || ''} onChange={e => { setSelZone(+e.target.value); setResult(null) }}>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name} — Pop. {z.population?.toLocaleString()}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ width: 160, marginBottom: 0 }}>
            <label className="form-label">Forecast Horizon</label>
            <select className="form-select" value={periods} onChange={e => setPeriods(+e.target.value)}>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={9}>9 Months</option>
              <option value={12}>12 Months</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={runForecast} disabled={running} style={{ height: 44 }}>
            {running ? <><div className="spinner" /> Running Prophet…</> : <><Play size={15} /> Run Forecast</>}
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Accuracy Metrics */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
              <div className="stat-card blue fade-up">
                <div className="stat-card-label">Model</div>
                <div className="stat-card-value" style={{ fontSize: 20 }}>Prophet</div>
                <div className="stat-card-change">Facebook/Meta time series</div>
              </div>
              <div className="stat-card green fade-up">
                <div className="stat-card-label">MAE</div>
                <div className="stat-card-value" style={{ fontSize: 20 }}>{result.mae?.toFixed(2) || '—'}</div>
                <div className="stat-card-change">Mean Absolute Error</div>
              </div>
              <div className="stat-card purple fade-up">
                <div className="stat-card-label">RMSE</div>
                <div className="stat-card-value" style={{ fontSize: 20 }}>{result.rmse?.toFixed(2) || '—'}</div>
                <div className="stat-card-change">Root Mean Squared Error</div>
              </div>
              <div className="stat-card cyan fade-up">
                <div className="stat-card-label">Forecast Period</div>
                <div className="stat-card-value" style={{ fontSize: 20 }}>{periods} Mo.</div>
                <div className="stat-card-change">Confidence interval: 80%</div>
              </div>
            </div>

            {/* Main Chart */}
            <div className="chart-container" style={{ marginBottom: 24 }}>
              <div className="chart-title">
                {selMetric.label} — {zones.find(z => z.id === selZone)?.name || 'Zone'}
              </div>
              <div className="chart-sub">
                Historical data + {periods}-month prediction with 80% confidence interval
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={selMetric.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={selMetric.color} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={selMetric.color} stopOpacity={0.08} />
                      <stop offset="95%" stopColor={selMetric.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ds" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => v?.slice(0,7)} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="none" fill="url(#gConfidence)" />
                  <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="none" fill="url(#gConfidence)" />
                  <Line type="monotone" dataKey="actual"    name={`Actual (${selMetric.unit})`}  stroke="#64748b" strokeWidth={1.5} dot={{ r:2 }} connectNulls />
                  <Line type="monotone" dataKey="predicted" name={`Predicted (${selMetric.unit})`} stroke={selMetric.color} strokeWidth={2.5} dot={{ r:2.5 }} strokeDasharray={chartData.some(d=>d.type==='forecast') ? undefined : undefined} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast Table */}
            <div className="card">
              <div className="chart-title" style={{ marginBottom: 16 }}>
                Predicted Values — Next {periods} Months
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Predicted ({selMetric.unit})</th>
                      <th>Lower Bound</th>
                      <th>Upper Bound</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.forecast || []).map((f, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>
                          {new Date(f.forecast_month).toLocaleDateString('en-KE', { year: 'numeric', month: 'short' })}
                        </td>
                        <td style={{ color: selMetric.color, fontWeight: 700, fontSize: 14 }}>
                          {selMetric.unit === 'KES' ? `KES ${fmt(f.predicted)}` : `${fmt(f.predicted)} ${selMetric.unit}`}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmt(f.lower_bound)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmt(f.upper_bound)}</td>
                        <td><span className="badge badge-info">80%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!result && !running && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <BarChart3 size={56} style={{ margin: '0 auto 16px', opacity: 0.4, color: 'var(--brand-primary)' }} />
            <h3 style={{ color: 'var(--text-secondary)', fontSize: 18, marginBottom: 8 }}>
              Select a zone and run a forecast
            </h3>
            <p style={{ fontSize: 13, maxWidth: 380, margin: '0 auto' }}>
              The Prophet model will analyze historical billing data and project future {metric.replace('_', ' ')} patterns.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
