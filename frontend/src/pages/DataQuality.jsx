import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { dataQualityApi, zonesApi } from '../api/client'
import {
  Database, CheckCircle, Clock, Search,
  ChevronDown, ChevronUp, AlertCircle, FileText
} from 'lucide-react'

const STATUS_CONFIG = {
  open:          { label: 'Open',          color: '#ef4444', icon: AlertCircle },
  investigating: { label: 'Investigating', color: '#f59e0b', icon: Clock },
  resolved:      { label: 'Resolved',      color: '#22c55e', icon: CheckCircle },
}

const ISSUE_TYPES = {
  zero_readings: 'Zero Readings',
  sensor_error: 'Sensor Error',
  missing_data: 'Missing Data',
  manual_entry_error: 'Manual Entry Error',
  spike_anomaly: 'Spike Anomaly',
  meter_tampering: 'Meter Tampering',
}

export default function DataQuality() {
  const { user } = useAuth()
  const [flags, setFlags] = useState([])
  const [stats, setStats] = useState({})
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterZone, setFilterZone] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [stewardNotes, setStewardNotes] = useState('')
  const [updating, setUpdating] = useState(false)

  const canEdit = ['admin', 'superadmin', 'data_steward'].includes(user?.role)

  useEffect(() => { loadData() }, [filterStatus, filterZone])

  async function loadData() {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterZone) params.zone_id = filterZone
      const [flagsRes, statsRes, zonesRes] = await Promise.all([
        dataQualityApi.listFlags(params),
        dataQualityApi.flagSummary(),
        zonesApi.list(),
      ])
      setFlags(flagsRes.data)
      setStats(statsRes.data)
      setZones(zonesRes.data)
    } catch (err) {
      console.error('Failed to load flags:', err)
    }
    setLoading(false)
  }

  async function handleUpdate(flagId, newStatus) {
    setUpdating(true)
    try {
      const payload = { status: newStatus }
      if (stewardNotes.trim()) payload.steward_notes = stewardNotes
      await dataQualityApi.updateFlag(flagId, payload)
      setStewardNotes('')
      setExpandedId(null)
      loadData()
    } catch (err) {
      alert('Failed to update flag: ' + (err.response?.data?.detail || err.message))
    }
    setUpdating(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Quality Flags</h1>
          <p className="page-subtitle">
            Manage dirty sensor data and manual entry errors before they feed into the forecasting models.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Flags</div>
          <div className="kpi-value">{stats.total || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="kpi-label">Open Issues</div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{stats.open || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="kpi-label">Investigating</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{stats.investigating || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #6b7280' }}>
          <div className="kpi-label">Affected Records</div>
          <div className="kpi-value">{stats.total_affected_records || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filterZone} onChange={e => setFilterZone(e.target.value)} className="filter-select">
          <option value="">All Zones</option>
          {zones.map(z => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
      </div>

      {/* Flag List */}
      {loading ? (
        <div className="loading-full"><div className="spinner" />Loading flags...</div>
      ) : flags.length === 0 ? (
        <div className="empty-state">No data quality flags found.</div>
      ) : (
        <div className="ticket-list">
          {flags.map(flag => {
            const statusConf = STATUS_CONFIG[flag.status] || STATUS_CONFIG.open
            const StatusIcon = statusConf.icon
            const isExpanded = expandedId === flag.id

            return (
              <div key={flag.id} className="ticket-card">
                <div className="ticket-card-header" onClick={() => setExpandedId(isExpanded ? null : flag.id)}>
                  <div className="ticket-card-left">
                    <Database size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <div>
                      <div className="ticket-title">{ISSUE_TYPES[flag.issue_type] || flag.issue_type}</div>
                      <div className="ticket-meta">
                        {flag.zone_name && <><span>{flag.zone_name}</span><span className="ticket-meta-sep">|</span></>}
                        {flag.meter_no && <><span>Meter: {flag.meter_no}</span><span className="ticket-meta-sep">|</span></>}
                        {new Date(flag.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="ticket-card-right">
                    <span className="status-badge" style={{ backgroundColor: statusConf.color + '22', color: statusConf.color, border: `1px solid ${statusConf.color}44` }}>
                      <StatusIcon size={12} /> {statusConf.label}
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="ticket-card-body">
                    <p className="ticket-description">{flag.description}</p>

                    <div className="ticket-detail-row">
                      <strong>Affected Records:</strong> {flag.affected_records || 0}
                    </div>

                    {flag.steward_notes && (
                      <div className="ticket-detail-row">
                        <strong>Steward Notes:</strong> {flag.steward_notes}
                      </div>
                    )}

                    {flag.resolved_at && (
                      <div className="ticket-detail-row">
                        <strong>Resolved:</strong> {new Date(flag.resolved_at).toLocaleString()}
                      </div>
                    )}

                    {/* Action buttons for Data Stewards */}
                    {canEdit && flag.status !== 'resolved' && (
                      <div className="ticket-actions">
                        <textarea
                          className="field-notes-input"
                          placeholder="Add notes..."
                          value={expandedId === flag.id ? stewardNotes : ''}
                          onChange={e => setStewardNotes(e.target.value)}
                          rows={2}
                        />
                        <div className="ticket-action-buttons">
                          {flag.status === 'open' && (
                            <button
                              className="btn btn-warning"
                              onClick={() => handleUpdate(flag.id, 'investigating')}
                              disabled={updating}
                            >
                              <Clock size={14} /> Start Investigating
                            </button>
                          )}
                          <button
                            className="btn btn-success"
                            onClick={() => handleUpdate(flag.id, 'resolved')}
                            disabled={updating}
                          >
                            <CheckCircle size={14} /> Mark Resolved
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
