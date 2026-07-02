import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kiwasco_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-redirect on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kiwasco_token')
      localStorage.removeItem('kiwasco_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Named helpers ──────────────────────────────────────
export const authApi = {
  login: (username, password) => {
    const form = new URLSearchParams({ username, password })
    return api.post('/api/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
  register: (payload) => api.post('/api/auth/register', payload),
  me: () => api.get('/api/auth/me'),
}

export const dashboardApi = {
  summary:  () => api.get('/api/dashboard/summary'),
  kpiCards: () => api.get('/api/dashboard/kpi-cards'),
  alerts:   () => api.get('/api/dashboard/alerts'),
  markRead: (id) => api.patch(`/api/dashboard/alerts/${id}/read`),
}

export const zonesApi = {
  list:   () => api.get('/api/zones/'),
  stats:  (id) => api.get(`/api/zones/${id}/stats`),
  create: (data) => api.post('/api/zones/', data),
}

export const customersApi = {
  list:       (params) => api.get('/api/customers/', { params }),
  count:      (zone_id) => api.get('/api/customers/count', { params: { zone_id } }),
  defaulters: (zone_id) => api.get('/api/customers/defaulters', { params: { zone_id } }),
}

export const billsApi = {
  list:         (params) => api.get('/api/bills/', { params }),
  monthlyTrend: (zone_id) => api.get('/api/bills/monthly-trend', { params: zone_id ? { zone_id } : {} }),
  zoneCompare:  (year, month) => api.get('/api/bills/zone-comparison', { params: { year, month } }),
  recordPayment:(id, amount) => api.patch(`/api/bills/${id}/pay`, null, { params: { amount } }),
}

export const forecastsApi = {
  run:     (payload) => api.post('/api/forecasts/run', payload),
  zone:    (zone_id) => api.get(`/api/forecasts/zone/${zone_id}`),
  summary: () => api.get('/api/forecasts/summary'),
}

export const reportsApi = {
  summary:     (year, zone_id) => api.get('/api/reports/summary', { params: { year, zone_id } }),
  downloadXlsx:(year, zone_id) => {
    return api.get('/api/reports/excel', {
      params: { year, zone_id },
      responseType: 'blob',
    })
  },
}

// ── New Role-Based Operational APIs ──────────────────────
export const ticketsApi = {
  list:    (params) => api.get('/api/tickets/leaks', { params }),
  get:     (id) => api.get(`/api/tickets/leaks/${id}`),
  create:  (data) => api.post('/api/tickets/leaks', data),
  update:  (id, data) => api.patch(`/api/tickets/leaks/${id}`, data),
  summary: () => api.get('/api/tickets/leaks/stats/summary'),
}

export const revenueAnomaliesApi = {
  list:    (params) => api.get('/api/revenue-anomalies', { params }),
  get:     (id) => api.get(`/api/revenue-anomalies/${id}`),
  create:  (data) => api.post('/api/revenue-anomalies', data),
  update:  (id, data) => api.patch(`/api/revenue-anomalies/${id}`, data),
  detect:  (params) => api.post('/api/revenue-anomalies/detect', params || {}),
  summary: () => api.get('/api/revenue-anomalies/stats/summary'),
}

export const dataQualityApi = {
  listFlags:   (params) => api.get('/api/data-quality/flags', { params }),
  getFlag:     (id) => api.get(`/api/data-quality/flags/${id}`),
  createFlag:  (data) => api.post('/api/data-quality/flags', data),
  updateFlag:  (id, data) => api.patch(`/api/data-quality/flags/${id}`, data),
  flagSummary: () => api.get('/api/data-quality/flags/stats/summary'),
  auditLog:    (params) => api.get('/api/data-quality/audit', { params }),
}
