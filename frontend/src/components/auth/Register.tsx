import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Container, Box, Paper, Typography, TextField, Button, Alert,
    InputAdornment, IconButton, CircularProgress
} from '@mui/material';
import { Visibility, VisibilityOff, PersonAdd } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-toastify';

export const Register: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        fullName: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            const { email, username, password, fullName } = formData;
            await login(email, password); // Login after registration
            toast.success('Registration successful!');
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed');
            toast.error('Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm">
            <Box sx={{ mt: 4, mb: 4 }}>
                <Paper elevation={3} sx={{ p: 4 }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Typography variant="h4" gutterBottom>
                            Create Account
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            Join the Order Dimension Tracker
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Full Name"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            sx={{ mb: 2 }}
                            disabled={loading}
                            required
                        />

                        <TextField
                            fullWidth
                            label="Username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            sx={{ mb: 2 }}
                            disabled={loading}
                            required
                        />

                        <TextField
                            fullWidth
                            label="Email Address"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            sx={{ mb: 2 }}
                            disabled={loading}
                            required
                        />

                        <TextField
                            fullWidth
                            label="Password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={handleChange}
                            sx={{ mb: 2 }}
                            disabled={loading}
                            required
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />

                        <TextField
                            fullWidth
                            label="Confirm Password"
                            name="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            sx={{ mb: 2 }}
                            disabled={loading}
                            required
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={20} /> : <PersonAdd />}
                            sx={{ mt: 2 }}
                        >
                            {loading ? 'Creating...' : 'Create Account'}
                        </Button>
                    </form>

                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="body2">
                            Already have an account? <Link to="/login">Sign in</Link>
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};