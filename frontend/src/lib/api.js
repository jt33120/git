
import axios from 'axios'

const isProd = import.meta.env.PROD;
const api = axios.create({
  baseURL: isProd
    ? (import.meta.env.VITE_API_URL || 'https://git-production-af3c.up.railway.app')
    : '/api',
  timeout: 60000, // 60s — AI matching can take time
})

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
