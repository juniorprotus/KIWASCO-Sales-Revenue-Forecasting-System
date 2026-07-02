import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { dataQualityApi } from '../api/client'
import { Shield, Clock, Search, ChevronDown, ChevronUp } from 'lucide-react'

export default function AuditLog() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterResource, setFilterResource] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { loadData() }, [filterAction, filterResource])

  async function loadData() {
    setLoading(true)
    try {
      const params = { limit: 100 }
      if (filterAction) params.action = filterAction
      if (filterResource) params.resource_type = filterResource
      const res = await dataQualityApi.auditLog(params)
      setLogs(res.data)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    }
    setLoading(false)
  }

  // Derive unique actions and resources for dropdowns
  const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))]
  const uniqueResources = [...new Set(logs.map(l => l.resource_type).filter(Boolean))]

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Audit Log</h1>
          <p className="page-subtitle">
            Immutable record of critical system events for WASREB and Auditor-General compliance.
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="filter-select">
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterResource} onChange={e => setFilterResource(e.target.value)} className="filter-select">
          <option value="">All Resources</option>
          {uniqueResources.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading-full"><div className="spinner" />Loading audit trail...</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">No audit logs found.</div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <strong>{log.username}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {log.user_id}</div>
                  </td>
                  <td>
                    <span className="status-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', textTransform: 'none' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    {log.resource_type ? (
                      <>
                        {log.resource_type}
                        {log.resource_id && <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>#{log.resource_id}</span>}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>
                  <td style={{ maxWidth: '300px' }}>
                    {log.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
