"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import { api } from '../../../lib/api';

interface Member { _id: string; email: string; name: string }
interface Project { _id: string; name: string; description?: string; owner: Member; members: Member[] }
interface Task { _id: string; title: string; status: 'todo'|'in_progress'|'done'; assignee?: Member }

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);

  const loadProject = () => api.get(`/projects/${projectId}`).then(r=>setProject(r.data));
  const loadTasks = () => api.get(`/tasks/project/${projectId}`).then(r=>setTasks(r.data));

  useEffect(()=>{ if(projectId){ loadProject(); loadTasks(); } }, [projectId]);

  useEffect(()=>{
    const t = setTimeout(()=>{
      if(query) api.get(`/users/search`, { params: { email: query } }).then(r=>setResults(r.data));
      else setResults([]);
    }, 250);
    return ()=>clearTimeout(t);
  }, [query]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/tasks', { project: projectId, title });
      setTitle(''); loadTasks();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed');
    }
  };

  const setStatus = async (id: string, status: Task['status']) => {
    await api.patch(`/tasks/${id}`, { status });
    loadTasks();
  };

  const assignTo = async (id: string, assigneeId: string) => {
    await api.patch(`/tasks/${id}`, { assignee: assigneeId });
    loadTasks();
  };

  const addMember = async (memberId: string) => {
    await api.post(`/projects/${projectId}/members`, { memberId });
    setQuery(''); setResults([]); loadProject();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Even if logout fails on server, still clear local token
    }
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  const allMembers = useMemo(()=> project ? [project.owner, ...project.members] : [], [project]);

  return (
    <AuthGuard>
      <main className="p-6 max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={() => router.push('/dashboard')}
                className="text-blue-600 hover:underline"
              >
                ← Back to Dashboard
              </button>
            </div>
            <div className="text-2xl font-bold">{project?.name || 'Project'}</div>
            {project?.description && <div className="text-gray-600">{project.description}</div>}
          </div>
          <button 
            onClick={logout}
            className="bg-red-600 text-white rounded px-4 py-2 hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <section className="space-y-2">
          <div className="font-medium">Members</div>
          <div className="flex flex-wrap gap-2">
            {allMembers.map(m => (
              <span key={m._id} className="px-2 py-1 rounded bg-gray-100 text-sm">{m.name} ({m.email})</span>
            ))}
          </div>
          <div className="mt-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Add by email" className="border rounded p-2 w-full max-w-md" />
            {!!results.length && (
              <div className="border rounded mt-1 w-full max-w-md bg-white divide-y">
                {results.map(u => (
                  <button key={u._id} onClick={()=>addMember(u._id)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                    {u.name} ({u.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <form onSubmit={createTask} className="space-y-2 border rounded p-4">
            <div className="font-medium">Create Task</div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input className="w-full border rounded p-2" placeholder="Task title" value={title} onChange={e=>setTitle(e.target.value)} />
            <button className="bg-blue-600 text-white rounded px-4 py-2">Add</button>
          </form>

          <ul className="space-y-2">
            {tasks.map(t => (
              <li key={t._id} className="border rounded p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-gray-600">{t.status}</div>
                </div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 border rounded" onClick={()=>setStatus(t._id, 'todo')}>Todo</button>
                  <button className="px-2 py-1 border rounded" onClick={()=>setStatus(t._id, 'in_progress')}>In progress</button>
                  <button className="px-2 py-1 border rounded" onClick={()=>setStatus(t._id, 'done')}>Done</button>
                </div>
                <div>
                  <select className="border rounded p-2 w-full" value={t.assignee?._id || ''} onChange={e=>assignTo(t._id, e.target.value)}>
                    <option value="">Unassigned</option>
                    {allMembers.map(m => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AuthGuard>
  );
}
