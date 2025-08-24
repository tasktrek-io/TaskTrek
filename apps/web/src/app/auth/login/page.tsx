'use client';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '../../../lib/socket-auth';
import { Box, TextField, Button, Typography, Alert, Paper, Container } from '@mui/material';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: '',
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
      password: validateField('password', password),
    };

    setValidationErrors(errors);
    return !errors.email && !errors.password;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({ email: '', password: '' });
    setShowResendVerification(false);

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post('/auth/login', { email, password });
      // Store the token and connect socket
      if (response.data.token) {
        login(response.data.token, router);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Login failed';
      setError(errorMessage);

      // Check if error is about email not being verified
      if (errorMessage.includes('verify') || errorMessage.includes('verification')) {
        setShowResendVerification(true);
      }
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
      setShowResendVerification(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to resend verification email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container
      maxWidth='sm'
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 400, p: 4 }}>
        <Box
          component='form'
          onSubmit={onSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <Typography variant='h4' component='h1' textAlign='center' fontWeight='600'>
            Welcome Back
          </Typography>

          {error && (
            <Alert severity='error' sx={{ mb: 2 }}>
              {error}
              {showResendVerification && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    onClick={resendVerification}
                    disabled={isLoading}
                    variant='outlined'
                    size='small'
                    fullWidth
                  >
                    {isLoading ? 'Sending...' : 'Resend Verification Email'}
                  </Button>
                </Box>
              )}
            </Alert>
          )}

          <TextField
            fullWidth
            label='Email Address'
            placeholder='Enter your email'
            type='email'
            value={email}
            onChange={e => handleFieldChange('email', e.target.value)}
            error={!!validationErrors.email}
            helperText={validationErrors.email}
            required
            variant='outlined'
            disabled={isLoading}
          />

          <TextField
            fullWidth
            label='Password'
            placeholder='Enter your password'
            type='password'
            value={password}
            onChange={e => handleFieldChange('password', e.target.value)}
            error={!!validationErrors.password}
            helperText={validationErrors.password}
            required
            variant='outlined'
            disabled={isLoading}
          />

          <Button
            type='submit'
            fullWidth
            variant='contained'
            size='large'
            disabled={isLoading}
            sx={{
              py: 1.5,
              mt: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>

          <Typography variant='body2' textAlign='center' sx={{ mt: 1 }}>
            <Link
              href='/auth/forgot-password'
              style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 500 }}
            >
              Forgot your password?
            </Link>
          </Typography>

          <Typography variant='body2' textAlign='center' sx={{ mt: 2 }}>
            Don't have an account?{' '}
            <Link
              href='/auth/register'
              style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 500 }}
            >
              Create one here
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
