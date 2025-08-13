"use client";
import { useState } from 'react';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await api.post('/auth/register', { email, name, password });
      // Store the token in localStorage
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 border rounded p-4">
        <h1 className="text-xl font-semibold">Create account</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input className="w-full border rounded p-2" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded p-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white rounded p-2">Sign up</button>
        <div className="text-sm">Already have an account? <Link className="text-blue-600 underline" href="/auth/login">Login</Link></div>
      </form>
    </main>
  );
}
