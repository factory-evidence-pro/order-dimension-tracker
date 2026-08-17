import { useState, useEffect } from 'react';
import { tokenManager, authService } from '../services/auth';
import { User } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(tokenManager.getUser());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = tokenManager.getUser();
        if (storedUser) {
            setUser(storedUser);
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        const user = await authService.login(email, password);
        setUser(user);
        return user;
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    return { user, loading, login, logout, isAuthenticated: !!user };
};