// frontend/src/utils/apiClient.js
import axios from 'axios';
import { API_BASE } from '../config/api';

/**
 * Create axios instance with JWT token from localStorage
 * Automatically includes Authorization header in all requests
 */
const createApiClient = () => {
    const client = axios.create({
        baseURL: API_BASE,
        timeout: 15000
    });

    // Request interceptor - add token to headers
    client.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401 (token expired)
    client.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                // Token expired or invalid - clear auth and redirect to login
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUser');
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }
    );

    return client;
};

const apiClient = createApiClient();

export default apiClient;

/**
 * Helper functions for common API calls
 */
export const ticketAPI = {
    // Get all tickets (filtered by user if not IT Staff)
    // params: { startDate, endDate, search } — all optional. Without them
    // the backend defaults to the last 180 days of finished tickets (plus
    // all still-active ones); pass a wider range to look further back.
    getTickets: (params) => apiClient.get('/tickets', { params }),

    // Get single ticket
    getTicket: (ticketId) => apiClient.get(`/tickets/${ticketId}`),

    // Create new ticket
    createTicket: (ticketData) => apiClient.post('/tickets', ticketData),

    // Update ticket (IT Staff only)
    updateTicket: (ticketId, updateData) => apiClient.put(`/tickets/${ticketId}`, updateData),

    // Delete ticket (IT Staff only)
    deleteTicket: (ticketId) => apiClient.delete(`/tickets/${ticketId}`),

    // Get statistics
    getStats: () => apiClient.get('/tickets/stats'),

    // Get ticket history
    getTicketHistory: (ticketId) => apiClient.get(`/tickets/${ticketId}/history`),

    // Add comment
    addTicketComment: (ticketId, comment) => apiClient.post(`/tickets/${ticketId}/comments`, { comment }),
    addHelper: (ticketId, empCode) => apiClient.post(`/tickets/${ticketId}/assignees`, { empCode }),
    removeHelper: (ticketId, empCode) => apiClient.delete(`/tickets/${ticketId}/assignees/${empCode}`),

    // Search stock products (proxied through the Helpdesk backend to Stock's API - avoids CORS)
    searchStockProducts: (search, deviceType) => apiClient.get('/stock/products', { params: { search, deviceType } }),
    getStockDeviceTypes: () => apiClient.get('/stock/device-types'),
};

export const statAPI = {
    getStats: () => apiClient.get('/tickets/stats'),
};