import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { revenueAnomaliesApi } from '../api/client'
import {
  DollarSign, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, AlertTriangle, Search, Zap
} from 'lucide-react'

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#f59e0b', icon: Clock },
  validated: { label: 'Validated', color: '#22c55e', icon: CheckCircle },
  dismissed: { label: 'Dismissed', color: '#6b7280', icon: XCircle },
}

const TYPE_LABELS = {
  zero_usage_high_bill: 'Zero Usage / High Bill',
  sudden_drop: 'Sudden Revenue Drop',
  payment_gap: 'Payment Gap',
  overbilling: 'Overbilling',
  underbilling: 'Underbilling',
  prolonged_non_payment: 'Prolonged Non-Payment',
}

export default function RevenueAnomalies() {
  const { user } = useAuth()
  const [anomalies, setAnomalies] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [officerNotes, setOfficerNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [detecting, setDetecting] = useState(false)

  const canReview = ['admin', 'superadmin', 'revenue_officer', 'analyst'].includes(user?.role)
  const canDetect = ['admin', 'superadmin', 'analyst'].includes(user?.role)

  useEffect(() => { loadData() }, [filterStatus, filterType])

  async function loadData() {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterType) params.anomaly_type = filterType
      const [anomalyRes, statsRes] = await Promise.all([
        revenueAnomaliesApi.list(params),
        revenueAnomaliesApi.summary(),
      ])
      setAnomalies(anomalyRes.data)
      setStats(statsRes.data)
    } catch (err) {
      console.error('Failed to load anomalies:', err)
    }
    setLoading(false)
  }

  async function handleUpdate(anomalyId, newStatus) {
    setUpdating(true)
    try {
      const payload = { status: newStatus }
      if (officerNotes.trim()) payload.officer_notes = officerNotes
      await revenueAnomaliesApi.update(anomalyId, payload)
      setOfficerNotes('')
      setExpandedId(null)
      loadData()
    } catch (err) {
      alert('Failed to update anomaly: ' + (err.response?.data?.detail || err.message))
    }
    setUpdating(false)
  }

  async function handleDetect() {
    setDetecting(true)
    try {
      const res = await revenueAnomaliesApi.detect({})
      alert(res.data.message || 'Detection complete')
      loadData()
    } catch (err) {
      alert('Detection failed: ' + (err.response?.data?.detail || err.message))
    }
    setDetecting(false)
  }

  function formatKES(val) {
    if (!val && val !== 0) return 'N/A'
    return 'KES ' + Number(val).toLocaleString()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue Anomalies</h1>
          <p className="page-subtitle">
            AI-detected billing discrepancies. Revenue officers validate before any billing action.
          </p>
        </div>
        {canDetect && (
          <button className="btn btn-primary" onClick={handleDetect} disabled={detecting}>
            <Zap size={14} /> {detecting ? 'Scanning...' : 'Run Detection'}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Anomalies</div>
          <div className="kpi-value">{stats.total || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="kpi-label">Pending Review</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{stats.pending || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #22c55e' }}>
          <div className="kpi-label">Validated</div>
          <div className="kpi-value" style={{ color: '#22c55e' }}>{stats.validated || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="kpi-label">Pending Discrepancy</div>
          <div className="kpi-value" style={{ color: '#ef4444', fontSize: '1.1rem' }}>{formatKES(stats.total_pending_discrepancy_kes)}</div>
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
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Anomaly List */}
      {loading ? (
        <div className="loading-full"><div className="spinner" />Loading anomalies...</div>
      ) : anomalies.length === 0 ? (
        <div className="empty-state">No revenue anomalies found.</div>
      ) : (
        <div className="ticket-list">
          {anomalies.map(anomaly => {
            const statusConf = STATUS_CONFIG[anomaly.status] || STATUS_CONFIG.pending
            const StatusIcon = statusConf.icon
            const isExpanded = expandedId === anomaly.id

            return (
              <div key={anomaly.id} className="ticket-card">
                <div className="ticket-card-header" onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}>
                  <div className="ticket-card-left">
                    <DollarSign size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div>
                      <div className="ticket-title">{TYPE_LABELS[anomaly.anomaly_type] || anomaly.anomaly_type}</div>
                      <div className="ticket-meta">
                        {anomaly.customer_name && <><span>{anomaly.customer_name}</span><span className="ticket-meta-sep">|</span></>}
                        {anomaly.amount_discrepancy && <>{formatKES(anomaly.amount_discrepancy)}<span className="ticket-meta-sep">|</span></>}
                        {new Date(anomaly.created_at).toLocaleDateString()}
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
                    <p className="ticket-description">{anomaly.description}</p>

                    {anomaly.officer_notes && (
                      <div className="ticket-detail-row">
                        <strong>Officer Notes:</strong> {anomaly.officer_notes}
                      </div>
                    )}

                    {anomaly.reviewed_at && (
                      <div className="ticket-detail-row">
                        <strong>Reviewed:</strong> {new Date(anomaly.reviewed_at).toLocaleString()}
                      </div>
                    )}

                    {/* Action buttons for revenue officers */}
                    {canReview && anomaly.status === 'pending' && (
                      <div className="ticket-actions">
                        <textarea
                          className="field-notes-input"
                          placeholder="Add officer notes..."
                          value={expandedId === anomaly.id ? officerNotes : ''}
                          onChange={e => setOfficerNotes(e.target.value)}
                          rows={2}
                        />
                        <div className="ticket-action-buttons">
                          <button
                            className="btn btn-success"
                            onClick={() => handleUpdate(anomaly.id, 'validated')}
                            disabled={updating}
                          >
                            <CheckCircle size={14} /> Validate
                          </button>
                          <button
                            className="btn btn-muted"
                            onClick={() => handleUpdate(anomaly.id, 'dismissed')}
                            disabled={updating}
                          >
                            <XCircle size={14} /> Dismiss
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
