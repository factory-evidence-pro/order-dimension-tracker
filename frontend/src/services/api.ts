import axios from 'axios';
import { Order, ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const orderApi = {
    getOrders: (params?: any) => 
        api.get<ApiResponse<Order[]>>('/orders', { params }),
    
    getOrderByTracking: (trackingNumber: string) =>
        api.get<ApiResponse<Order>>(`/orders/${trackingNumber}`),
    
    // ✅ Updated with duplicate handling
    saveDimensions: (data: any) =>
        api.post<ApiResponse<Order>>('/orders/save', data),
    
    // ✅ New: Force overwrite
    forceOverwrite: (data: any) =>
        api.post<ApiResponse<Order>>('/orders/force-overwrite', data),
    
    checkOrder: (trackingNumber: string) =>
        api.get<ApiResponse<{ existsInBigSeller: boolean; existsInDb: boolean }>>(`/orders/check/${trackingNumber}`),
    
    refreshData: () =>
        api.post<ApiResponse<{ message: string }>>('/refresh'),
    
    exportOrders: (params?: any) =>
        api.get('/export', { ...params, responseType: 'blob' }),
    
    // ✅ New: Duplicate report (Admin)
    getDuplicateReport: () =>
        api.get('/admin/duplicates'),
    
    // ✅ New: Daily stats (Admin)
    getDailyStats: () =>
        api.get('/admin/stats/daily'),
};

export const authApi = {
    login: (data: any) => api.post('/auth/login', data),
    register: (data: any) => api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
};

export const adminApi = {
    getUsers: () => api.get('/admin/users'),
    createUser: (data: any) => api.post('/admin/users', data),
    updateUser: (id: string, data: any) => api.put(`/admin/users/${id}`, data),
    deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
    getStats: () => api.get('/admin/stats'),
};
