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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    email: '',
    password: ''
  });

  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'name':
        if (value.length < 3) return 'Name must be at least 3 characters long';
        if (!/^[a-zA-Z\s]+$/.test(value)) return 'Name must contain only letters and spaces';
        return '';
      case 'email':
        if (!value) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return '';
      case 'password':
        if (value.length < 8) return 'Password must be at least 8 characters long';
        return '';
      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    switch (field) {
      case 'name':
        setName(value);
        setValidationErrors(prev => ({ ...prev, name: validateField('name', value) }));
        break;
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
      name: validateField('name', name),
      email: validateField('email', email),
      password: validateField('password', password)
    };

    setValidationErrors(errors);
    return !errors.name && !errors.email && !errors.password;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({ name: '', email: '', password: '' });

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post('/auth/register', { email, name, password });
      
      // Store email for potential resend verification
      localStorage.setItem('pendingVerificationEmail', email);
      
      // Show verification message instead of redirecting
      setShowVerificationMessage(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async () => {
    try {
      setIsLoading(true);
      await api.post('/auth/resend-verification', { email });
      setError('');
      alert('Verification email sent successfully! Please check your inbox.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to resend verification email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 400, p: 4 }}>
        {showVerificationMessage ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'center' }}>
            <Typography variant="h4" component="h1" fontWeight="600" color="success.main">
              Check Your Email
            </Typography>
            
            <Typography variant="body1" color="text.secondary">
              We've sent a verification link to <strong>{email}</strong>
            </Typography>
            
            <Typography variant="body2" color="text.secondary">
              Please check your email and click the verification link to complete your registration.
            </Typography>

            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            <Button
              onClick={resendVerification}
              disabled={isLoading}
              variant="outlined"
              fullWidth
            >
              {isLoading ? 'Sending...' : 'Resend Verification Email'}
            </Button>

            <Typography variant="body2" color="text.secondary">
              Didn't receive the email? Check your spam folder or{' '}
              <Button 
                onClick={() => setShowVerificationMessage(false)} 
                variant="text" 
                sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
              >
                try a different email
              </Button>
            </Typography>

            <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
              Already have an account?{' '}
              <Link href="/auth/login" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 500 }}>
                Login here
              </Link>
            </Typography>
          </Box>
        ) : (
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h4" component="h1" textAlign="center" fontWeight="600">
              Create Account
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Full Name"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              error={!!validationErrors.name}
              helperText={validationErrors.name}
              required
              variant="outlined"
              disabled={isLoading}
            />

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
              disabled={isLoading}
            />

            <TextField
              fullWidth
              label="Password"
              placeholder="Enter password (min 8 characters)"
              type="password"
              value={password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              error={!!validationErrors.password}
              helperText={validationErrors.password}
              required
              variant="outlined"
              disabled={isLoading}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ 
                py: 1.5,
                mt: 2,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600
              }}
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>

            <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
              Already have an account?{' '}
              <Link href="/auth/login" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 500 }}>
                Login here
              </Link>
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
