'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

// Separate component that uses useSearchParams
function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await api.post('/auth/verify-email', {
        token: verificationToken
      });

      setStatus('success');
      setMessage('Email verified successfully! You are now logged in.');
      
      // Store the token
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        // Dispatch custom login event for socket connection
        window.dispatchEvent(new CustomEvent('socket:login', { 
          detail: { token: response.data.token } 
        }));
      }

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Email verification failed. Please try again.');
    }
  };

  const resendVerification = async () => {
    try {
      setIsResending(true);
      const email = localStorage.getItem('pendingVerificationEmail');
      
      if (!email) {
        setMessage('Unable to resend verification email. Please register again.');
        return;
      }

      await api.post('/auth/resend-verification', { email });
      setMessage('Verification email sent successfully! Please check your inbox.');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            {status === 'loading' && (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            )}
            {status === 'success' && (
              <div className="rounded-full h-12 w-12 bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="rounded-full h-12 w-12 bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {message}
            </p>

            {status === 'success' && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Redirecting to dashboard in 3 seconds...
                  </p>
                </div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Dashboard Now
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <button
                  onClick={resendVerification}
                  disabled={isResending}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Sending...' : 'Resend Verification Email'}
                </button>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
                  >
                    Back to Login
                  </button>
                  <button
                    onClick={() => router.push('/auth/register')}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
                  >
                    Register Again
                  </button>
                </div>
              </div>
            )}

            {status === 'loading' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Please wait while we verify your email address...
              </p>
            )}
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Having trouble? Contact our support team for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}

// Loading component for Suspense fallback
function VerifyEmailLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Loading...
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Please wait while we load the verification page...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense wrapper
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}