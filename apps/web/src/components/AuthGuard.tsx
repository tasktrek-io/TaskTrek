"use client";
import { ReactNode, useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    api.get('/auth/me')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!authed) {
    return (
      <div className="p-6">
        <p>You are not signed in.</p>
        <a href="/auth/login" className="text-blue-600 underline">Go to Login</a>
      </div>
    );
  }
  return <>{children}</>;  
}
