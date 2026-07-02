import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ticketsApi, zonesApi } from '../api/client'
import {
  AlertTriangle, CheckCircle, XCircle, Clock,
  MapPin, ChevronDown, ChevronUp, Send
} from 'lucide-react'

const STATUS_CONFIG = {
  open:           { label: 'Open',           color: '#ef4444', icon: Clock },
  confirmed:      { label: 'Confirmed',      color: '#f59e0b', icon: AlertTriangle },
  false_positive:  { label: 'False Positive', color: '#6b7280', icon: XCircle },
  resolved:       { label: 'Resolved',       color: '#22c55e', icon: CheckCircle },
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: '#ef4444' },
  high:     { label: 'High',     color: '#f59e0b' },
  medium:   { label: 'Medium',   color: '#3b82f6' },
  low:      { label: 'Low',      color: '#6b7280' },
}

export default function LeakTickets() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState({})
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterZone, setFilterZone] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [fieldNotes, setFieldNotes] = useState('')
  const [updating, setUpdating] = useState(false)

  const isFieldOfficer = ['admin', 'superadmin', 'field_officer', 'analyst'].includes(user?.role)

  useEffect(() => { loadData() }, [filterStatus, filterZone])

  async function loadData() {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterZone) params.zone_id = filterZone
      const [ticketRes, statsRes, zonesRes] = await Promise.all([
        ticketsApi.list(params),
        ticketsApi.summary(),
        zonesApi.list(),
      ])
      setTickets(ticketRes.data)
      setStats(statsRes.data)
      setZones(zonesRes.data)
    } catch (err) {
      console.error('Failed to load tickets:', err)
    }
    setLoading(false)
  }

  async function handleUpdateStatus(ticketId, newStatus) {
    setUpdating(true)
    try {
      const payload = { status: newStatus }
      if (fieldNotes.trim()) payload.field_notes = fieldNotes
      await ticketsApi.update(ticketId, payload)
      setFieldNotes('')
      setExpandedId(null)
      loadData()
    } catch (err) {
      alert('Failed to update ticket: ' + (err.response?.data?.detail || err.message))
    }
    setUpdating(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">NRW Leak Tickets</h1>
          <p className="page-subtitle">
            AI-generated alerts for Non-Revenue Water losses. Field officers inspect and resolve these tickets.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Tickets</div>
          <div className="kpi-value">{stats.total || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="kpi-label">Open</div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{stats.open || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="kpi-label">Confirmed</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{stats.confirmed || 0}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '3px solid #22c55e' }}>
          <div className="kpi-label">Resolved</div>
          <div className="kpi-value" style={{ color: '#22c55e' }}>{stats.resolved || 0}</div>
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

      {/* Ticket List */}
      {loading ? (
        <div className="loading-full"><div className="spinner" />Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">No leak tickets found.</div>
      ) : (
        <div className="ticket-list">
          {tickets.map(ticket => {
            const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
            const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium
            const StatusIcon = statusConf.icon
            const isExpanded = expandedId === ticket.id

            return (
              <div key={ticket.id} className="ticket-card">
                <div className="ticket-card-header" onClick={() => setExpandedId(isExpanded ? null : ticket.id)}>
                  <div className="ticket-card-left">
                    <span className="ticket-priority-dot" style={{ backgroundColor: priorityConf.color }} title={priorityConf.label} />
                    <div>
                      <div className="ticket-title">{ticket.title}</div>
                      <div className="ticket-meta">
                        <MapPin size={12} /> {ticket.zone_name}
                        <span className="ticket-meta-sep">|</span>
                        {ticket.predicted_nrw ? `${ticket.predicted_nrw.toLocaleString()} m3` : 'N/A'}
                        <span className="ticket-meta-sep">|</span>
                        {new Date(ticket.created_at).toLocaleDateString()}
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
                    <p className="ticket-description">{ticket.description}</p>

                    {ticket.nrw_threshold_pct && (
                      <div className="ticket-detail-row">
                        <strong>NRW Above Baseline:</strong> {ticket.nrw_threshold_pct}%
                      </div>
                    )}

                    {ticket.field_notes && (
                      <div className="ticket-detail-row">
                        <strong>Field Notes:</strong> {ticket.field_notes}
                      </div>
                    )}

                    {ticket.resolved_at && (
                      <div className="ticket-detail-row">
                        <strong>Resolved:</strong> {new Date(ticket.resolved_at).toLocaleString()}
                      </div>
                    )}

                    {/* Action buttons for field officers */}
                    {isFieldOfficer && ticket.status !== 'resolved' && ticket.status !== 'false_positive' && (
                      <div className="ticket-actions">
                        <textarea
                          className="field-notes-input"
                          placeholder="Add field notes (optional)..."
                          value={expandedId === ticket.id ? fieldNotes : ''}
                          onChange={e => setFieldNotes(e.target.value)}
                          rows={2}
                        />
                        <div className="ticket-action-buttons">
                          {ticket.status === 'open' && (
                            <>
                              <button
                                className="btn btn-warning"
                                onClick={() => handleUpdateStatus(ticket.id, 'confirmed')}
                                disabled={updating}
                              >
                                <AlertTriangle size={14} /> Confirm Leak
                              </button>
                              <button
                                className="btn btn-muted"
                                onClick={() => handleUpdateStatus(ticket.id, 'false_positive')}
                                disabled={updating}
                              >
                                <XCircle size={14} /> False Positive
                              </button>
                            </>
                          )}
                          {ticket.status === 'confirmed' && (
                            <button
                              className="btn btn-success"
                              onClick={() => handleUpdateStatus(ticket.id, 'resolved')}
                              disabled={updating}
                            >
                              <CheckCircle size={14} /> Mark Resolved
                            </button>
                          )}
                          {fieldNotes.trim() && (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleUpdateStatus(ticket.id, ticket.status)}
                              disabled={updating}
                            >
                              <Send size={14} /> Save Notes
                            </button>
                          )}
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
