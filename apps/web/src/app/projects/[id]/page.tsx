"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import { api } from '../../../lib/api';

interface Member { _id: string; email: string; name: string }
interface Project { 
  _id: string; 
  name: string; 
  description?: string; 
  status: string;
  tags: string[];
  owner: Member; 
  members: Member[];
  workspace: { _id: string; name: string };
}
interface Task { 
  _id: string; 
  title: string; 
  description?: string;
  status: 'todo'|'in_progress'|'done'; 
  priority: 'low'|'medium'|'high'|'urgent';
  dueDate?: string;
  assignees: Member[];
  watchers: Member[];
  createdBy: Member;
}

interface Comment {
  _id: string;
  content: string;
  author: Member;
  createdAt: string;
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  // Comment form
  const [newComment, setNewComment] = useState('');
  
  // Member search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);

  const loadProject = () => api.get(`/projects/${projectId}`).then(r=>setProject(r.data));
  const loadTasks = () => api.get(`/tasks/project/${projectId}`).then(r=>setTasks(r.data));

  useEffect(()=>{ 
    if(projectId){ 
      loadProject(); 
      loadTasks(); 
    } 
  }, [projectId]);

  useEffect(()=>{
    const t = setTimeout(()=>{
      if(query) api.get(`/users/search`, { params: { email: query } }).then(r=>setSearchResults(r.data));
      else setSearchResults([]);
    }, 250);
    return ()=>clearTimeout(t);
  }, [query]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError('');
    
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    
    try {
      await api.post('/tasks', { 
        project: projectId, 
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        assignees: selectedAssignees
      });
      
      setTitle(''); 
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setSelectedAssignees([]);
      setShowTaskModal(false);
      loadTasks();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create task');
    }
  };

  const updateTaskStatus = async (id: string, status: Task['status']) => {
    try {
      await api.patch(`/tasks/${id}`, { status });
      loadTasks();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const openTaskDetail = async (task: Task) => {
    try {
      const response = await api.get(`/tasks/${task._id}`);
      setSelectedTask(response.data.task);
      setComments(response.data.comments);
      setShowTaskDetail(true);
    } catch (err) {
      console.error('Failed to load task details:', err);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;
    
    try {
      const response = await api.post(`/tasks/${selectedTask._id}/comments`, {
        content: newComment.trim()
      });
      setComments(prev => [...prev, response.data]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const toggleWatcher = async (taskId: string, action: 'add' | 'remove') => {
    try {
      const response = await api.post(`/tasks/${taskId}/watchers`, { action });
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data);
      }
    } catch (err) {
      console.error('Failed to toggle watcher:', err);
    }
  };

  const addMember = async (memberId: string) => {
    await api.post(`/projects/${projectId}/members`, { memberId });
    setQuery(''); 
    setSearchResults([]); 
    loadProject();
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'todo': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done')
  };

  return (
    <AuthGuard>
      <main className="p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={() => router.push('/workspaces')}
                className="text-blue-600 hover:underline"
              >
                ← Back
              </button>
            </div>
            <div className="text-2xl font-bold">{project?.name || 'Project'}</div>
            {project?.description && <div className="text-gray-600">{project.description}</div>}
            {project?.workspace && (
              <div className="text-sm text-gray-500 mt-1">
                Workspace: {project.workspace.name}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTaskModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Add Task
            </button>
            <button 
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{tasksByStatus.todo.length}</div>
            <div className="text-sm text-gray-600">To Do</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">{tasksByStatus.in_progress.length}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{tasksByStatus.done.length}</div>
            <div className="text-sm text-gray-600">Done</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-600">{tasks.length}</div>
            <div className="text-sm text-gray-600">Total Tasks</div>
          </div>
        </div>

        {/* Members Section */}
        <section className="bg-white rounded-lg border p-6">
          <div className="font-medium mb-4">Team Members</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {allMembers.map(m => (
              <span key={m._id} className="px-3 py-1 rounded-full bg-gray-100 text-sm">
                {m.name} ({m.email})
              </span>
            ))}
          </div>
          <div className="relative">
            <input 
              value={query} 
              onChange={e=>setQuery(e.target.value)} 
              placeholder="Add member by email" 
              className="border rounded-lg p-2 w-full max-w-md" 
            />
            {!!searchResults.length && (
              <div className="absolute top-full left-0 border rounded-lg mt-1 w-full max-w-md bg-white shadow-lg z-10 divide-y">
                {searchResults.map(u => (
                  <button 
                    key={u._id} 
                    onClick={()=>addMember(u._id)} 
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    {u.name} ({u.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Tasks Kanban Board */}
        <section className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-6">Tasks</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 capitalize">
                    {status.replace('_', ' ')}
                  </h3>
                  <span className="text-sm text-gray-500">{statusTasks.length}</span>
                </div>
                
                <div className="space-y-3 min-h-[200px]">
                  {statusTasks.map(task => (
                    <div
                      key={task._id}
                      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openTaskDetail(task)}
                    >
                      <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        {task.dueDate && (
                          <span className="text-xs text-gray-500">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      
                      {task.assignees.length > 0 && (
                        <div className="flex gap-1 mb-2">
                          {task.assignees.slice(0, 3).map(assignee => (
                            <div
                              key={assignee._id}
                              className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs"
                            >
                              {assignee.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {task.assignees.length > 3 && (
                            <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs">
                              +{task.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        {status !== 'todo' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task._id, 'todo');
                            }}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          >
                            Todo
                          </button>
                        )}
                        {status !== 'in_progress' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task._id, 'in_progress');
                            }}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          >
                            In Progress
                          </button>
                        )}
                        {status !== 'done' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task._id, 'done');
                            }}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {statusTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Create Task Modal */}
        {showTaskModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Create New Task</h2>
                  <button
                    onClick={() => {
                      setShowTaskModal(false);
                      setError('');
                      setTitle('');
                      setDescription('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={createTask} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter task title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter task description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Task['priority'])}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assignees
                    </label>
                    <div className="space-y-2">
                      {allMembers.map(member => (
                        <label key={member._id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedAssignees.includes(member._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAssignees(prev => [...prev, member._id]);
                              } else {
                                setSelectedAssignees(prev => prev.filter(id => id !== member._id));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{member.name} ({member.email})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTaskModal(false);
                        setError('');
                        setTitle('');
                        setDescription('');
                      }}
                      className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    >
                      Create Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {showTaskDetail && selectedTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(selectedTask.priority)}`}>
                        {selectedTask.priority} Priority
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                        {selectedTask.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900">{selectedTask.title}</h2>
                    <p className="text-gray-600 mt-1">
                      Created by {selectedTask.createdBy.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleWatcher(selectedTask._id, 
                        selectedTask.watchers.some(w => w._id === selectedTask.createdBy._id) ? 'remove' : 'add'
                      )}
                      className="px-3 py-1 border rounded hover:bg-gray-50 text-sm"
                    >
                      👁 Watch
                    </button>
                    <button
                      onClick={() => setShowTaskDetail(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Description */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        {selectedTask.description || 'No description provided'}
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-4">Comments</h3>
                      
                      <form onSubmit={addComment} className="mb-4">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                        <button
                          type="submit"
                          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                          Add Comment
                        </button>
                      </form>

                      <div className="space-y-4">
                        {comments.map(comment => (
                          <div key={comment._id} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                                {comment.author.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{comment.author.name}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <p className="text-gray-700">{comment.content}</p>
                          </div>
                        ))}
                        {comments.length === 0 && (
                          <p className="text-gray-500 text-center py-4">No comments yet</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Assignees */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Assignees</h3>
                      <div className="space-y-2">
                        {selectedTask.assignees.length > 0 ? (
                          selectedTask.assignees.map(assignee => (
                            <div key={assignee._id} className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                {assignee.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm">{assignee.name}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No assignees</p>
                        )}
                      </div>
                    </div>

                    {/* Watchers */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Watchers</h3>
                      <div className="space-y-2">
                        {selectedTask.watchers.length > 0 ? (
                          selectedTask.watchers.map(watcher => (
                            <div key={watcher._id} className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                                {watcher.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm">{watcher.name}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No watchers</p>
                        )}
                      </div>
                    </div>

                    {/* Due Date */}
                    {selectedTask.dueDate && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Due Date</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(selectedTask.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
