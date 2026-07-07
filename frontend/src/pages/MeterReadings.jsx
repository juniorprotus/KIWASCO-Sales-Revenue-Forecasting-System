import { useState, useEffect } from 'react'
import { customersApi, meterReadingsApi, zonesApi } from '../api/client'
import { Search, MapPin, Hash, CheckCircle2, User as UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MeterReadings() {
  const [zones, setZones] = useState([])
  const [selZone, setSelZone] = useState('')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Selected customer to add reading for
  const [activeCustomer, setActiveCustomer] = useState(null)
  const [readingValue, setReadingValue] = useState('')

  useEffect(() => {
    zonesApi.list().then(r => setZones(r.data)).catch(console.error)
  }, [])

  const searchCustomers = async () => {
    if (!selZone && !search) return toast.error('Select a zone or enter a search term')
    setLoading(true)
    try {
      const params = {}
      if (selZone) params.zone_id = selZone
      if (search) params.search = search
      const res = await customersApi.list(params)
      setCustomers(res.data || [])
      if (res.data.length === 0) toast('No customers found', { icon: '🔍' })
    } catch (err) {
      toast.error('Failed to search customers')
    } finally {
      setLoading(false)
    }
  }

  const submitReading = async () => {
    if (!readingValue) return toast.error('Enter a valid reading')
    setSubmitting(true)
    try {
      await meterReadingsApi.create({
        customer_id: activeCustomer.id,
        reading_date: new Date().toISOString().split('T')[0],
        current_reading: parseFloat(readingValue),
      })
      toast.success('Reading logged successfully!')
      setActiveCustomer(null)
      setReadingValue('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit reading')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-header-title">Meter Readings</div>
          <div className="page-header-sub">Field Agent Data Entry</div>
        </div>
      </div>

      {!activeCustomer ? (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="form-group">
            <label className="form-label">Zone</label>
            <div className="input-with-icon">
              <MapPin size={16} />
              <select className="form-select" value={selZone} onChange={e => setSelZone(e.target.value)}>
                <option value="">All Zones</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Account or Meter No.</label>
            <div className="input-with-icon">
              <Search size={16} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. ACC-12345" 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchCustomers()}
              />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', height: 48 }} onClick={searchCustomers} disabled={loading}>
            {loading ? <div className="spinner" /> : 'Search Customers'}
          </button>

          {customers.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="chart-title" style={{ fontSize: 14, marginBottom: 12 }}>Search Results ({customers.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {customers.map(c => (
                  <div key={c.id} className="card" style={{ padding: 12, cursor: 'pointer', borderColor: 'var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setActiveCustomer(c)}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                        <span><Hash size={12} style={{ display: 'inline', verticalAlign: -2 }}/> {c.account_no}</span>
                        <span>Meter: {c.meter_no || 'N/A'}</span>
                      </div>
                    </div>
                    <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }}>Select</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <button className="btn btn-outline" style={{ marginBottom: 20, padding: '6px 12px', fontSize: 13 }} onClick={() => { setActiveCustomer(null); setReadingValue(''); }}>
            ← Back to Search
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--brand-primary)' }}>
              <UserIcon size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{activeCustomer.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Acc: {activeCustomer.account_no} • Meter: {activeCustomer.meter_no || 'Unknown'}</p>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: 15 }}>Enter Current Meter Reading (m³)</label>
            <input 
              type="number" 
              className="form-input" 
              style={{ fontSize: 24, padding: '20px 16px', textAlign: 'center', letterSpacing: 2, fontWeight: 600, color: 'var(--brand-primary)' }}
              placeholder="0000.0"
              value={readingValue}
              onChange={e => setReadingValue(e.target.value)}
              autoFocus
            />
          </div>

          <button className="btn btn-primary" style={{ width: '100%', height: 56, fontSize: 16, marginTop: 10 }} onClick={submitReading} disabled={submitting || !readingValue}>
            {submitting ? <div className="spinner" /> : <><CheckCircle2 size={20} /> Submit Reading</>}
          </button>
        </div>
      )}
    </div>
  )
}
