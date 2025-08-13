"use client";
import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import { api } from '../../lib/api';

interface Project { _id: string; name: string; description?: string }

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get('/projects').then(r => setProjects(r.data));
  useEffect(() => { load(); }, []);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const r = await api.post('/projects', { name, description });
      setName(''); setDescription('');
      setProjects(p => [r.data, ...p]);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create project');
    }
  };

  return (
    <AuthGuard>
      <main className="p-6 space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">My Projects</h1>

        <form onSubmit={createProject} className="space-y-2 border rounded p-4">
          <div className="font-medium">Create Project</div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input className="w-full border rounded p-2" placeholder="Project name" value={name} onChange={e=>setName(e.target.value)} />
          <input className="w-full border rounded p-2" placeholder="Description (optional)" value={description} onChange={e=>setDescription(e.target.value)} />
          <button className="bg-blue-600 text-white rounded px-4 py-2">Create</button>
        </form>

        <ul className="space-y-2">
          {projects.map(p => (
            <li key={p._id} className="border rounded p-3">
              <a href={`/projects/${p._id}`} className="font-medium text-blue-600 underline">{p.name}</a>
              {p.description && <div className="text-sm text-gray-600">{p.description}</div>}
            </li>
          ))}
        </ul>
      </main>
    </AuthGuard>
  );
}
