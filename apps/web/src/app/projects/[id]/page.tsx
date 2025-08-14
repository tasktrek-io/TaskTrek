"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import Sidebar from '../../../components/Sidebar';
import TaskActivity from '../../../components/TaskActivity';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
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
  reactions: {
    emoji: string;
    users: string[];
    count: number;
  }[];
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const projectId = params.id;
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  
  // Search states for watchers and assignees
  const [watcherSearchQuery, setWatcherSearchQuery] = useState('');
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [watcherSearchResults, setWatcherSearchResults] = useState<Member[]>([]);
  const [assigneeSearchResults, setAssigneeSearchResults] = useState<Member[]>([]);
  
  // Task editing states
  const [isEditing, setIsEditing] = useState<{ [key: string]: boolean }>({});
  const [editValues, setEditValues] = useState<{
    title: string;
    description: string;
    status: Task['status'];
    priority: Task['priority'];
    dueDate: string;
    assignees: string[];
  }>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
    assignees: []
  });
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  // Comment form
  const [newComment, setNewComment] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<Member[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ [commentId: string]: boolean }>({});
  
  // Member search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);

  const loadProject = () => api.get(`/projects/${projectId}`).then(r=>setProject(r.data));
  const loadTasks = () => api.get(`/tasks/project/${projectId}`).then(r=>setTasks(r.data));
  const loadCurrentUser = () => api.get('/auth/me').then(r=>setCurrentUser(r.data.user));

  useEffect(()=>{ 
    loadCurrentUser();
    if(projectId){ 
      loadProject(); 
      loadTasks(); 
    } 
  }, [projectId]);

  // Search for watchers
  useEffect(() => {
    const t = setTimeout(() => {
      if (watcherSearchQuery) {
        api.get(`/users/search`, { params: { q: watcherSearchQuery } })
          .then(r => setWatcherSearchResults(r.data.slice(0, 5)));
      } else {
        setWatcherSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [watcherSearchQuery]);

  // Search for assignees  
  useEffect(() => {
    const t = setTimeout(() => {
      if (assigneeSearchQuery) {
        api.get(`/users/search`, { params: { q: assigneeSearchQuery } })
          .then(r => setAssigneeSearchResults(r.data.slice(0, 5)));
      } else {
        setAssigneeSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [assigneeSearchQuery]);

  useEffect(()=>{ 
    if(projectId){ 
      loadProject(); 
      loadTasks(); 
    } 
  }, [projectId]);

  useEffect(()=>{
    const t = setTimeout(()=>{
      if(query) api.get(`/users/search`, { params: { q: query } }).then(r=>setSearchResults(r.data));
      else setSearchResults([]);
    }, 250);
    return ()=>clearTimeout(t);
  }, [query]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.emoji-picker-container')) {
        setShowEmojiPicker({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      
      // Initialize edit values
      setEditValues({
        title: response.data.task.title,
        description: response.data.task.description || '',
        status: response.data.task.status,
        priority: response.data.task.priority,
        dueDate: response.data.task.dueDate ? new Date(response.data.task.dueDate).toISOString().split('T')[0] : '',
        assignees: response.data.task.assignees.map((a: Member) => a._id)
      });
      
      setShowTaskDetail(true);
    } catch (err) {
      console.error('Failed to load task details:', err);
    }
  };

  const startEditing = (field: string) => {
    setIsEditing(prev => ({ ...prev, [field]: true }));
  };

  const cancelEditing = (field: string) => {
    setIsEditing(prev => ({ ...prev, [field]: false }));
    // Reset to original values
    if (selectedTask) {
      setEditValues(prev => ({
        ...prev,
        [field]: field === 'dueDate' 
          ? (selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : '')
          : selectedTask[field as keyof Task] || ''
      }));
    }
  };

  const saveField = async (field: string) => {
    if (!selectedTask) return;
    
    try {
      const updateData: any = {};
      
      if (field === 'assignees') {
        updateData[field] = editValues[field];
      } else {
        updateData[field] = editValues[field as keyof typeof editValues];
      }

      const response = await api.patch(`/tasks/${selectedTask._id}`, updateData);
      
      // Update the selected task with new data
      setSelectedTask(response.data);
      
      // Update the task in the tasks list
      setTasks(prev => prev.map(task => 
        task._id === selectedTask._id ? response.data : task
      ));
      
      setIsEditing(prev => ({ ...prev, [field]: false }));
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
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
      setShowMentions(false);
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const addReaction = async (commentId: string, emoji: string) => {
    if (!selectedTask) return;

    try {
      const response = await api.post(`/tasks/${selectedTask._id}/comments/${commentId}/reactions`, {
        emoji
      });
      
      // Update the comment in the comments list
      setComments(prev => prev.map(comment => 
        comment._id === commentId ? response.data : comment
      ));

      // Close emoji picker after selecting
      setShowEmojiPicker(prev => ({ ...prev, [commentId]: false }));
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };

  const toggleEmojiPicker = (commentId: string) => {
    setShowEmojiPicker(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const getCurrentUserReaction = (comment: Comment) => {
    // This would need the current user ID - for now return null
    // In a real app, you'd get this from auth context
    return null;
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    
    setNewComment(value);
    setCursorPosition(position);
    
    // Check for @ mentions
    const beforeCursor = value.substring(0, position);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setShowMentions(true);
      
      // Filter project members for suggestions
      const suggestions = allMembers.filter(member => 
        member.name.toLowerCase().includes(query.toLowerCase()) ||
        member.email.toLowerCase().includes(query.toLowerCase())
      );
      setMentionSuggestions(suggestions);
    } else {
      setShowMentions(false);
    }
  };

  // Helper function to render comment content with highlighted mentions
  const renderCommentContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      // If index is odd, it's a mention
      if (index % 2 === 1) {
        return (
          <span key={index} className="bg-blue-100 text-blue-800 px-1 rounded">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const insertMention = (member: Member) => {
    const beforeCursor = newComment.substring(0, cursorPosition);
    const afterCursor = newComment.substring(cursorPosition);
    
    // Replace the @query with @memberName
    const beforeMention = beforeCursor.replace(/@\w*$/, '');
    const newValue = beforeMention + `@${member.name} ` + afterCursor;
    
    setNewComment(newValue);
    setShowMentions(false);
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

  const addWatcher = async (taskId: string, userId: string) => {
    try {
      const response = await api.post(`/tasks/${taskId}/watchers`, { 
        userId,
        action: 'add' 
      });
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data);
      }
      setWatcherSearchQuery('');
      setWatcherSearchResults([]);
    } catch (err) {
      console.error('Failed to add watcher:', err);
    }
  };

  const removeWatcher = async (taskId: string, userId: string) => {
    try {
      const response = await api.post(`/tasks/${taskId}/watchers`, { 
        userId,
        action: 'remove' 
      });
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data);
      }
    } catch (err) {
      console.error('Failed to remove watcher:', err);
    }
  };

  const addAssignee = async (taskId: string, userId: string) => {
    try {
      if (!selectedTask) return;
      
      const newAssignees = [...selectedTask.assignees.map(a => a._id), userId];
      const response = await api.patch(`/tasks/${taskId}`, { assignees: newAssignees });
      
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data);
      }
      setAssigneeSearchQuery('');
      setAssigneeSearchResults([]);
    } catch (err) {
      console.error('Failed to add assignee:', err);
    }
  };

  const removeAssignee = async (taskId: string, userId: string) => {
    try {
      if (!selectedTask) return;
      
      const newAssignees = selectedTask.assignees.filter(a => a._id !== userId).map(a => a._id);
      const response = await api.patch(`/tasks/${taskId}`, { assignees: newAssignees });
      
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data);
      }
    } catch (err) {
      console.error('Failed to remove assignee:', err);
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
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto space-y-8">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            <button 
              onClick={() => router.push('/dashboard')}
              className="hover:text-blue-600 transition-colors"
            >
              Dashboard
            </button>
            <span>›</span>
            <button 
              onClick={() => router.push('/workspaces')}
              className="hover:text-blue-600 transition-colors"
            >
              Workspaces
            </button>
            <span>›</span>
            {project?.workspace && (
              <>
                <button 
                  onClick={() => router.push(`/workspaces/${project.workspace._id}`)}
                  className="hover:text-blue-600 transition-colors"
                >
                  {project.workspace.name}
                </button>
                <span>›</span>
              </>
            )}
            <span className="text-gray-900 font-medium">{project?.name}</span>
          </nav>

          {/* Project Header */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{project?.name || 'Project'}</h1>
                {project?.description && (
                  <p className="text-gray-600 mb-2">{project.description}</p>
                )}
                {project?.workspace && (
                  <p className="text-sm text-gray-500">
                    Workspace: {project.workspace.name}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Add Task
                </button>
                <button 
                  onClick={logout}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
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
              placeholder="Add member by name or email" 
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
                <div className="flex justify-between items-start mb-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      {/* Priority Badge */}
                      {isEditing.priority ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editValues.priority}
                            onChange={(e) => setEditValues(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                            className="px-3 py-1 border rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                          <button
                            onClick={() => saveField('priority')}
                            className="text-green-600 hover:text-green-700 text-sm p-1 hover:bg-green-50 rounded"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => cancelEditing('priority')}
                            className="text-red-600 hover:text-red-700 text-sm p-1 hover:bg-red-50 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing('priority')}
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedTask.priority)} hover:opacity-80 transition-all`}
                        >
                          {selectedTask.priority.toUpperCase()}
                        </button>
                      )}

                      {/* Status Badge */}
                      {isEditing.status ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editValues.status}
                            onChange={(e) => setEditValues(prev => ({ ...prev, status: e.target.value as Task['status'] }))}
                            className="px-3 py-1 border rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          <button
                            onClick={() => saveField('status')}
                            className="text-green-600 hover:text-green-700 text-sm p-1 hover:bg-green-50 rounded"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => cancelEditing('status')}
                            className="text-red-600 hover:text-red-700 text-sm p-1 hover:bg-red-50 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing('status')}
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedTask.status)} hover:opacity-80 transition-all`}
                        >
                          {selectedTask.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      )}
                    </div>
                    
                    {/* Task Title */}
                    {isEditing.title ? (
                      <div className="flex items-center gap-2 mb-4">
                        <input
                          type="text"
                          value={editValues.title}
                          onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
                          className="text-3xl font-bold text-gray-900 border-none focus:outline-none bg-transparent flex-1 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                          autoFocus
                        />
                        <button
                          onClick={() => saveField('title')}
                          className="text-green-600 hover:text-green-700 p-2 hover:bg-green-50 rounded"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => cancelEditing('title')}
                          className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing('title')}
                        className="text-left hover:bg-gray-50 rounded-lg p-2 w-full group mb-4 transition-colors"
                      >
                        <h1 className="text-3xl font-bold text-gray-900">
                          {selectedTask.title} 
                          <span className="opacity-0 group-hover:opacity-100 text-lg ml-2 text-gray-400">✏️</span>
                        </h1>
                      </button>
                    )}
                    
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>Created by</span>
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                        {selectedTask.createdBy.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{selectedTask.createdBy.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTaskDetail(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl"
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
                      {isEditing.description ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValues.description}
                            onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={4}
                            placeholder="Enter task description"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveField('description')}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => cancelEditing('description')}
                              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing('description')}
                          className="w-full text-left bg-gray-50 rounded-lg p-4 hover:bg-gray-100 group"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-gray-700">
                              {selectedTask.description || 'No description provided'}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 text-sm">✏️</span>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Comments */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-4">Comments</h3>
                      
                      <form onSubmit={addComment} className="mb-4 relative">
                        <textarea
                          value={newComment}
                          onChange={handleCommentChange}
                          placeholder="Add a comment... (type @ to mention someone)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                        
                        {/* Mention Suggestions */}
                        {showMentions && mentionSuggestions.length > 0 && (
                          <div className="absolute bottom-16 left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto z-10">
                            {mentionSuggestions.map(member => (
                              <button
                                key={member._id}
                                type="button"
                                onClick={() => insertMention(member)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{member.name}</div>
                                  <div className="text-xs text-gray-500">{member.email}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        
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
                                {comment.author?.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{comment.author?.name || 'Unknown User'}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <p className="text-gray-700 mb-3">{renderCommentContent(comment.content)}</p>
                            
                            {/* Emoji Reactions */}
                            <div className="flex flex-wrap gap-2 items-center">
                              {/* Existing Reactions */}
                              {comment.reactions?.filter(r => r.count > 0).map((reaction, index) => (
                                <button
                                  key={`${reaction.emoji}-${index}`}
                                  onClick={() => addReaction(comment._id, reaction.emoji)}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                                >
                                  <span>{reaction.emoji}</span>
                                  <span className="text-xs text-gray-600">{reaction.count}</span>
                                </button>
                              ))}
                              
                              {/* Add Reaction Button */}
                              <div className="relative emoji-picker-container">
                                <button
                                  onClick={() => toggleEmojiPicker(comment._id)}
                                  className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:bg-gray-100 rounded-full text-sm transition-colors"
                                  title="Add reaction"
                                >
                                  <span>😊</span>
                                  <span className="text-xs">Add</span>
                                </button>
                                
                                {/* Emoji Picker Dropdown */}
                                {showEmojiPicker[comment._id] && (
                                  <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-lg p-2 z-20 min-w-[200px]">
                                    <div className="grid grid-cols-5 gap-1">
                                      {['👍', '👎', '❤️', '😊', '😢', '😮', '😡', '🎉', '👏', '🔥'].map(emoji => (
                                        <button
                                          key={emoji}
                                          onClick={() => addReaction(comment._id, emoji)}
                                          className="w-10 h-10 hover:bg-gray-100 rounded-md flex items-center justify-center text-xl transition-colors border-0 p-1"
                                          title={`React with ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {comments.length === 0 && (
                          <p className="text-gray-500 text-center py-4">No comments yet</p>
                        )}
                      </div>
                    </div>

                    {/* Activity Section */}
                    <TaskActivity taskId={selectedTask._id} />
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Assignees */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">👤 Assignees</h3>
                      
                      {/* Add Assignee Search */}
                      <div className="mb-4">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search for users to assign..."
                            value={assigneeSearchQuery}
                            onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          
                          {/* Search Results Dropdown */}
                          {assigneeSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                              {assigneeSearchResults.map(user => (
                                <button
                                  key={user._id}
                                  onClick={() => addAssignee(selectedTask._id, user._id)}
                                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
                                  disabled={selectedTask.assignees.some(a => a._id === user._id)}
                                >
                                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="text-xs text-gray-600">{user.email}</p>
                                  </div>
                                  {selectedTask.assignees.some(a => a._id === user._id) && (
                                    <span className="ml-auto text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Already assigned</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Current Assignees */}
                      <div className="space-y-2">
                        {selectedTask.assignees.length > 0 ? (
                          selectedTask.assignees.map(assignee => (
                            <div key={assignee._id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                  {assignee.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{assignee.name}</span>
                                {currentUser && assignee._id === currentUser._id && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Me</span>
                                )}
                              </div>
                              <button
                                onClick={() => removeAssignee(selectedTask._id, assignee._id)}
                                className="text-red-500 hover:text-red-700 text-sm p-1 hover:bg-red-50 rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm py-2">No assignees</p>
                        )}
                      </div>
                    </div>

                    {/* Watchers */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">👀 Watchers</h3>
                      
                      {/* Current User Watch/Unwatch Toggle - Only show if not watching */}
                      {currentUser && !selectedTask.watchers.some(w => w._id === currentUser._id) && (
                        <div className="mb-4">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-lg">👁</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">Watch</p>
                                <p className="text-xs text-gray-600">Get notified of all activity on this task.</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleWatcher(selectedTask._id, 'add')}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Watch
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Add Watchers Search */}
                      <div className="mb-4">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400">🔍</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Search or enter name/email..."
                            value={watcherSearchQuery}
                            onChange={(e) => setWatcherSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        
                        {/* Watcher Search Results */}
                        {watcherSearchResults.length > 0 && (
                          <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm">
                            {watcherSearchResults.map(user => (
                              <button
                                key={user._id}
                                onClick={() => addWatcher(selectedTask._id, user._id)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                                disabled={selectedTask.watchers.some(w => w._id === user._id)}
                              >
                                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{user.name}</p>
                                  <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                                {selectedTask.watchers.some(w => w._id === user._id) && (
                                  <span className="ml-auto text-xs text-gray-400">Already watching</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Current Watchers List */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Watchers</h4>
                        {selectedTask.watchers.length > 0 ? (
                          selectedTask.watchers.map(watcher => (
                            <div key={watcher._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                                  {watcher.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{watcher.name}</span>
                                {currentUser && watcher._id === currentUser._id && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Me</span>
                                )}
                              </div>
                              <button
                                onClick={() => removeWatcher(selectedTask._id, watcher._id)}
                                className="text-red-500 hover:text-red-700 text-sm p-1 hover:bg-red-50 rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm py-2">No watchers</p>
                        )}
                      </div>
                    </div>

                    {/* Due Date */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-gray-900">Due Date</h3>
                        {!isEditing.dueDate && (
                          <button
                            onClick={() => startEditing('dueDate')}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </div>
                      
                      {isEditing.dueDate ? (
                        <div className="space-y-2">
                          <input
                            type="date"
                            value={editValues.dueDate}
                            onChange={(e) => setEditValues(prev => ({ ...prev, dueDate: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveField('dueDate')}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => cancelEditing('dueDate')}
                              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">
                          {selectedTask.dueDate 
                            ? new Date(selectedTask.dueDate).toLocaleDateString()
                            : 'No due date set'
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
    </AuthGuard>
  );
}
