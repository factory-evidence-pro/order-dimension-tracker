import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
    AppBar, Toolbar, Typography, Button, Box, IconButton,
    Avatar, Menu, MenuItem, Chip, Badge
} from '@mui/material';
import {
    Dashboard, QrCodeScanner, History, Settings,
    Logout, Person, Refresh
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import { orderApi } from '../../services/api';

export const Layout: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [refreshing, setRefreshing] = React.useState(false);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        handleMenuClose();
        logout();
        toast.info('Logged out');
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const response = await orderApi.refreshData();
            toast.success(response.data.message || 'Data refreshed');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Refresh failed');
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" color="primary">
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
                        📦 Order Tracker
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                            label={user?.role || 'User'}
                            size="small"
                            color={user?.role === 'admin' ? 'secondary' : 'default'}
                            sx={{ mr: 1 }}
                        />

                        <IconButton color="inherit" onClick={handleRefresh} disabled={refreshing}>
                            <Refresh />
                        </IconButton>

                        <IconButton color="inherit" onClick={() => navigate('/dashboard')}>
                            <Dashboard />
                        </IconButton>

                        <IconButton color="inherit" onClick={handleMenuOpen}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                                {user?.full_name?.[0] || user?.username?.[0] || 'U'}
                            </Avatar>
                        </IconButton>
                    </Box>

                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        <MenuItem disabled>
                            <Person sx={{ mr: 1 }} /> {user?.full_name || user?.username}
                        </MenuItem>
                        <MenuItem onClick={handleLogout}>
                            <Logout sx={{ mr: 1 }} /> Logout
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            <Box sx={{ flex: 1, p: 3, bgcolor: '#f1f5f9' }}>
                <Outlet />
            </Box>
        </Box>
    );
};