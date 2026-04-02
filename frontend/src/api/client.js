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
