import { authApi } from './api';
import { User } from '../types';

export const tokenManager = {
    getToken: () => localStorage.getItem('token'),
    setToken: (token: string) => localStorage.setItem('token', token),
    removeToken: () => localStorage.removeItem('token'),

    getUser: (): User | null => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
    setUser: (user: User) => localStorage.setItem('user', JSON.stringify(user)),
    removeUser: () => localStorage.removeItem('user'),
};

export const authService = {
    login: async (email: string, password: string) => {
        const response = await authApi.login({ email, password });
        const { token, user } = response.data;
        tokenManager.setToken(token);
        tokenManager.setUser(user);
        return user;
    },

    register: async (data: any) => {
        const response = await authApi.register(data);
        const { token, user } = response.data;
        tokenManager.setToken(token);
        tokenManager.setUser(user);
        return user;
    },

    logout: () => {
        tokenManager.removeToken();
        tokenManager.removeUser();
        window.location.href = '/login';
    },

    getCurrentUser: () => tokenManager.getUser(),
    isAuthenticated: () => !!tokenManager.getToken(),
};