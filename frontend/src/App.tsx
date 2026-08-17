import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { Dashboard } from './components/dashboard/Dashboard';
import { Layout } from './components/common/Layout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

const theme = createTheme({
    palette: {
        primary: { main: '#2563eb' },
        secondary: { main: '#64748b' },
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    components: {
        MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
        MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } },
    },
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000,
            refetchOnWindowFocus: false,
            retry: 2,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route element={<ProtectedRoute />}>
                            <Route element={<Layout />}>
                                <Route path="/" element={<Navigate to="/dashboard" />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                            </Route>
                        </Route>
                    </Routes>
                </BrowserRouter>
                <ToastContainer
                    position="bottom-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="light"
                />
            </ThemeProvider>
        </QueryClientProvider>
    );
}

export default App;