"use client";
import { useState } from 'react';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Container
} from '@mui/material';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: ''
  });

  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'email':
        if (!value) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        return '';
      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    switch (field) {
      case 'email':
        setEmail(value);
        setValidationErrors(prev => ({ ...prev, email: validateField('email', value) }));
        break;
      case 'password':
        setPassword(value);
        setValidationErrors(prev => ({ ...prev, password: validateField('password', value) }));
        break;
    }
  };

  const validateForm = () => {
    const errors = {
      email: validateField('email', email),
      password: validateField('password', password)
    };

    setValidationErrors(errors);
    return !errors.email && !errors.password;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({ email: '', password: '' });

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    try {
      const response = await api.post('/auth/login', { email, password });
      // Store the token in localStorage
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 400, p: 4 }}>
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="h4" component="h1" textAlign="center" fontWeight="600">
            Welcome Back
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Email Address"
            placeholder="Enter your email"
            type="email"
            value={email}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            error={!!validationErrors.email}
            helperText={validationErrors.email}
            required
            variant="outlined"
          />

          <TextField
            fullWidth
            label="Password"
            placeholder="Enter your password"
            type="password"
            value={password}
            onChange={(e) => handleFieldChange('password', e.target.value)}
            error={!!validationErrors.password}
            helperText={validationErrors.password}
            required
            variant="outlined"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ 
              py: 1.5,
              mt: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            Sign In
          </Button>

          <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
            Don't have an account?{' '}
            <Link href="/auth/register" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 500 }}>
              Create one here
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
