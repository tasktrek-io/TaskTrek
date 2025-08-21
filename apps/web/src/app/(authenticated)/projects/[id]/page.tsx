"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DropResult } from 'react-beautiful-dnd';
import TaskActivity from '../../../../components/TaskActivity';
import TaskDocuments from '../../../../components/FileUpload/TaskDocuments';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useSocket } from '../../../../contexts/SocketContext';
import { api } from '../../../../lib/api';
import { Icons } from '../../../../lib/icons';
import { canDeleteProject } from '../../../../lib/permissions';

// Dynamically import DragDropContext with no SSR
const DragDropContext = dynamic(
  () => import('react-beautiful-dnd').then(mod => mod.DragDropContext),
  { ssr: false }
);

const Droppable = dynamic(
  () => import('react-beautiful-dnd').then(mod => mod.Droppable),
  { ssr: false }
);

const Draggable = dynamic(
  () => import('react-beautiful-dnd').then(mod => mod.Draggable),
  { ssr: false }
);

interface Member { _id: string; email: string; name: string; id?: string }
interface Project { 
  _id: string; 
  name: string; 
  description?: string; 
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
  tags: string[];
  owner: Member; 
  members: Member[];
  workspace: { 
    _id: string; 
    name: string; 
    contextType: 'personal' | 'organization'; 
    contextId: string; 
  };
}
interface Task { 
  _id: string; 
  title: string; 
  description?: string;
  status: 'todo'|'in_progress'|'done'; 
  priority: 'low'|'medium'|'high'|'urgent';
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
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
  const { isUserOnline, joinProject, leaveProject, joinOrganization, leaveOrganization } = useSocket();
  const projectId = params.id;
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  
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
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<Task['status']>('todo');
  
  // Comment form
  const [newComment, setNewComment] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<Member[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ [commentId: string]: boolean }>({});

  // Comment edit and delete states
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [showCommentMenu, setShowCommentMenu] = useState<{ [commentId: string]: boolean }>({});
  const [showCommentDeleteConfirm, setShowCommentDeleteConfirm] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  
  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Project delete confirmation states
  const [showProjectDeleteConfirm, setShowProjectDeleteConfirm] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [canUserDeleteProject, setCanUserDeleteProject] = useState(false);
  
  // Member search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Project editing states
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [projectEditForm, setProjectEditForm] = useState({
    name: '',
    description: '',
    status: 'planning' as 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled',
    startDate: '',
    endDate: '',
    tags: [] as string[]
  });

  // Task filtering and search states
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [showTaskFilters, setShowTaskFilters] = useState(false);
  const [showTaskSort, setShowTaskSort] = useState(false);
  const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({});
  const [taskFilters, setTaskFilters] = useState({
    status: [] as string[],
    priority: [] as string[],
    assignees: [] as string[],
    tags: [] as string[],
    dueDateRange: { start: '', end: '' }
  });
  const [taskSort, setTaskSort] = useState({
    field: 'dateCreated' as 'status' | 'title' | 'assignee' | 'priority' | 'dueDate' | 'startDate' | 'dateCreated' | 'dateUpdated' | 'dateClosed',
    direction: 'desc' as 'asc' | 'desc'
  });

  // Activity refresh function - use ref to persist across re-renders
  const refreshActivitiesRef = useRef<(() => void) | null>(null);

  const handleActivitiesLoad = useCallback((refreshFunction: () => void) => {
    refreshActivitiesRef.current = refreshFunction;
  }, []);

  const loadProject = () => api.get(`/projects/${projectId}`).then(r=>{
    setProject(r.data);
    // Join project room for real-time updates only if changed
    if (r.data && currentProjectId !== r.data._id) {
      if (currentProjectId) {
        console.log('Leaving previous project room:', currentProjectId);
        leaveProject(currentProjectId);
      }
      
      console.log('Joining project room:', r.data._id);
      joinProject(r.data._id);
      setCurrentProjectId(r.data._id);
    }
  });
  const loadTasks = () => api.get(`/tasks/project/${projectId}`).then(r=>setTasks(r.data));
  const loadCurrentUser = () => api.get('/auth/me').then(r=>setCurrentUser(r.data.user));

  useEffect(()=>{ 
    loadCurrentUser();
    if(projectId){
      loadProject(); 
      loadTasks();
    }
    
    // Cleanup - leave rooms when component unmounts or project changes
    return () => {
      if (currentProjectId) {
        leaveProject(currentProjectId);
      }
      if (currentOrgId) {
        leaveOrganization(currentOrgId);
      }
    };
  }, [projectId, currentProjectId, currentOrgId, leaveProject, leaveOrganization]);

  // Join organization room when project data is available
  useEffect(() => {
    if (project && project.workspace && project.workspace.contextType === 'organization') {
      const orgId = project.workspace.contextId;
      if (currentOrgId !== orgId) {
        if (currentOrgId) {
          console.log('Leaving previous organization room:', currentOrgId);
          leaveOrganization(currentOrgId);
        }
        
        console.log('Joining organization room from project:', orgId);
        joinOrganization(orgId);
        setCurrentOrgId(orgId);
      }
    }
  }, [project, currentOrgId, joinOrganization, leaveOrganization]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if current user can delete the project
  useEffect(() => {
    const checkDeletePermissions = async () => {
      if (project && currentUser) {
        try {
          const canDelete = await canDeleteProject(project, currentUser._id);
          setCanUserDeleteProject(canDelete);
        } catch (error) {
          console.error('Error checking delete permissions:', error);
          setCanUserDeleteProject(false);
        }
      }
    };

    checkDeletePermissions();
  }, [project, currentUser]);

  // Search for watchers
  useEffect(() => {
    const t = setTimeout(() => {
      if (watcherSearchQuery && project?.workspace) {
        api.get(`/contexts/users/search`, { 
          params: { 
            q: watcherSearchQuery,
            contextType: project.workspace.contextType,
            contextId: project.workspace.contextId
          } 
        })
          .then(r => setWatcherSearchResults(r.data.slice(0, 5)));
      } else {
        setWatcherSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [watcherSearchQuery, project]);

  // Search for assignees  
  useEffect(() => {
    const t = setTimeout(() => {
      if (assigneeSearchQuery && project?.workspace) {
        api.get(`/contexts/users/search`, { 
          params: { 
            q: assigneeSearchQuery,
            contextType: project.workspace.contextType,
            contextId: project.workspace.contextId
          } 
        })
          .then(r => setAssigneeSearchResults(r.data.slice(0, 5)));
      } else {
        setAssigneeSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [assigneeSearchQuery, project]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.emoji-picker-container')) {
        setShowEmojiPicker({});
      }
      if (!target.closest('.project-menu-container')) {
        setShowProjectMenu(false);
      }
      if (!target.closest('.comment-menu-container')) {
        setShowCommentMenu({});
      }
      if (!target.closest('.task-filters-container') && !target.closest('[data-filter-button]')) {
        setShowTaskFilters(false);
        setShowTaskSort(false);
        setShowAssigneeFilter(false);
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
        assignees: selectedAssignees,
        status: defaultTaskStatus // Use the default status based on which section's Add Task was clicked
      });
      
      setTitle(''); 
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setSelectedAssignees([]);
      setDefaultTaskStatus('todo'); // Reset to default
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
      
      // Refresh activities to show the status change immediately
      if (refreshActivitiesRef.current) {
        refreshActivitiesRef.current();
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area
    if (!destination) {
      return;
    }

    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Convert droppableId to task status
    const newStatus = destination.droppableId as Task['status'];
    
    // Optimistically update the UI first
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task => 
        task._id === draggableId 
          ? { ...task, status: newStatus }
          : task
      );
      return updatedTasks;
    });

    // Then update the server
    try {
      await api.patch(`/tasks/${draggableId}`, { status: newStatus });
      // Don't call loadTasks() here as it would cause re-render during drag
      
      // Refresh activities to show the status change immediately
      if (refreshActivitiesRef.current) {
        refreshActivitiesRef.current();
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
      // Revert the optimistic update on error
      loadTasks();
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
      
      // Refresh activities to show the update immediately
      if (refreshActivitiesRef.current) {
        refreshActivitiesRef.current();
      }
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    }
  };

  const deleteTask = async () => {
    if (!selectedTask) return;
    
    setIsDeleting(true);
    try {
      await api.delete(`/tasks/${selectedTask._id}`);
      
      // Remove the task from the tasks list
      setTasks(prev => prev.filter(task => task._id !== selectedTask._id));
      
      // Close modals
      setShowTaskDetail(false);
      setShowDeleteConfirm(false);
      setSelectedTask(null);
    } catch (err) {
      console.error('Failed to delete task:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const quickDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening task detail modal
    
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }
    
    try {
      await api.delete(`/tasks/${taskId}`);
      
      // Remove the task from the tasks list
      setTasks(prev => prev.filter(task => task._id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const deleteProject = async () => {
    if (!project) return;
    
    setIsDeletingProject(true);
    try {
      await api.delete(`/projects/${project._id}`);
      
      // Redirect to workspace page
      router.push(`/workspaces/${project.workspace._id}`);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeletingProject(false);
      setShowProjectDeleteConfirm(false);
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
      
      // Refresh activities to show the new comment immediately
      if (refreshActivitiesRef.current) {
        refreshActivitiesRef.current();
      }
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
      
      // Refresh activities to show the reaction immediately
      if (refreshActivitiesRef.current) {
        refreshActivitiesRef.current();
      }
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };

  const toggleEmojiPicker = (commentId: string) => {
    setShowEmojiPicker(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const toggleCommentMenu = (commentId: string) => {
    setShowCommentMenu(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const startEditingComment = (comment: Comment) => {
    setEditingComment(comment._id);
    setEditCommentContent(comment.content);
    setShowCommentMenu({});
  };

  const cancelEditingComment = () => {
    setEditingComment(null);
    setEditCommentContent('');
  };

  const saveCommentEdit = async () => {
    if (!selectedTask || !editingComment || !editCommentContent.trim()) return;

    try {
      const response = await api.patch(`/tasks/${selectedTask._id}/comments/${editingComment}`, {
        content: editCommentContent.trim()
      });
      
      // Update the comment in the comments list
      setComments(prev => prev.map(comment => 
        comment._id === editingComment ? response.data : comment
      ));

      setEditingComment(null);
      setEditCommentContent('');
      
      // Refresh activities to show the comment edit immediately
      if (refreshActivitiesRef.current) {
        refreshActivitiesRef.current();
      }
    } catch (err) {
      console.error('Failed to edit comment:', err);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!selectedTask) return;
    
    setIsDeletingComment(true);
    try {
      await api.delete(`/tasks/${selectedTask._id}/comments/${commentId}`);
      
      // Remove the comment from the comments list
      setComments(prev => prev.filter(comment => comment._id !== commentId));
      
      setShowCommentDeleteConfirm(null);
      
      // Refresh activities to show the comment deletion immediately
      if (refreshActivitiesRef.current) {
        refreshActivitiesRef.current();
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    } finally {
      setIsDeletingComment(false);
    }
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
    // Updated regex to match the backend pattern for full names
    const mentionRegex = /@([A-Za-z][A-Za-z0-9\s]*[A-Za-z0-9]|[A-Za-z])/g;
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
    // Check if member is already in the project (either as owner or member)
    if (project) {
      const isAlreadyMember = project.owner._id === memberId || 
                             project.members.some(member => member._id === memberId);
      
      if (isAlreadyMember) {
        setQuery(''); 
        setSearchResults([]);
        return; // Don't add if already a member
      }
    }
    
    try {
      await api.post(`/projects/${projectId}/members`, { memberId });
      setQuery(''); 
      setSearchResults([]); 
      loadProject();
    } catch (err: any) {
      console.error('Failed to add member:', err);
      // Show error message to user if available
      if (err.response?.data?.error) {
        // You could set an error state here to display to the user
        console.log('Error:', err.response.data.error);
      }
    }
  };

  const openEditProjectModal = () => {
    if (project) {
      setProjectEditForm({
        name: project.name,
        description: project.description || '',
        status: project.status || 'planning',
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
        tags: project.tags || []
      });
    }
    setShowEditProjectModal(true);
    setShowProjectMenu(false);
  };

  const updateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    
    try {
      const updateData = {
        name: projectEditForm.name.trim(),
        description: projectEditForm.description.trim() || undefined,
        status: projectEditForm.status,
        startDate: projectEditForm.startDate || undefined,
        endDate: projectEditForm.endDate || undefined,
        tags: projectEditForm.tags
      };

      const response = await api.patch(`/projects/${projectId}`, updateData);
      setProject(response.data);
      setShowEditProjectModal(false);
    } catch (err: any) {
      console.error('Failed to update project:', err);
      // You could show an error message here
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !projectEditForm.tags.includes(tag.trim())) {
      setProjectEditForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setProjectEditForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Task filtering and sorting functions
  const toggleTaskFilter = (filterType: 'status' | 'priority' | 'assignees' | 'tags', value: string) => {
    setTaskFilters(prev => ({
      ...prev,
      [filterType]: (prev[filterType] as string[]).includes(value)
        ? (prev[filterType] as string[]).filter((item: string) => item !== value)
        : [...(prev[filterType] as string[]), value]
    }));
  };

  const clearAllFilters = () => {
    setTaskFilters({
      status: [],
      priority: [],
      assignees: [],
      tags: [],
      dueDateRange: { start: '', end: '' }
    });
    setTaskSearchQuery('');
  };

  const toggleTaskSort = (field: typeof taskSort.field) => {
    setTaskSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSectionCollapse = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const openTaskModalWithStatus = (status: Task['status']) => {
    setDefaultTaskStatus(status);
    setShowTaskModal(true);
  };

  const filterAndSortTasks = (tasks: Task[]) => {
    let filteredTasks = [...tasks];

    // Apply search filter
    if (taskSearchQuery) {
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(taskSearchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (taskFilters.status.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        taskFilters.status.includes(task.status)
      );
    }

    // Apply priority filter
    if (taskFilters.priority.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        taskFilters.priority.includes(task.priority)
      );
    }

    // Apply assignee filter
    if (taskFilters.assignees.length > 0) {
      filteredTasks = filteredTasks.filter(task => {
        if (taskFilters.assignees.includes('unassigned')) {
          return task.assignees.length === 0 || task.assignees.some(assignee =>
            taskFilters.assignees.includes(assignee._id)
          );
        }
        return task.assignees.some(assignee =>
          taskFilters.assignees.includes(assignee._id)
        );
      });
    }

    // Apply due date range filter
    if (taskFilters.dueDateRange.start || taskFilters.dueDateRange.end) {
      filteredTasks = filteredTasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        const startDate = taskFilters.dueDateRange.start ? new Date(taskFilters.dueDateRange.start) : null;
        const endDate = taskFilters.dueDateRange.end ? new Date(taskFilters.dueDateRange.end) : null;
        
        if (startDate && endDate) {
          return taskDate >= startDate && taskDate <= endDate;
        } else if (startDate) {
          return taskDate >= startDate;
        } else if (endDate) {
          return taskDate <= endDate;
        }
        return true;
      });
    }

    // Apply sorting
    filteredTasks.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (taskSort.field) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'assignee':
          aValue = a.assignees[0]?.name?.toLowerCase() || 'zzz';
          bValue = b.assignees[0]?.name?.toLowerCase() || 'zzz';
          break;
        case 'dateCreated':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }

      if (aValue < bValue) return taskSort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return taskSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredTasks;
  };

  const allMembers = useMemo(() => {
    if (!project) return [];
    
    // Create a Set to track unique member IDs and avoid duplicates
    const uniqueMembers = new Map();
    
    // Add owner first
    uniqueMembers.set(project.owner._id, project.owner);
    
    // Add members, but skip if already exists (i.e., owner is also in members array)
    project.members.forEach(member => {
      if (!uniqueMembers.has(member._id)) {
        uniqueMembers.set(member._id, member);
      }
    });
    
    return Array.from(uniqueMembers.values());
  }, [project]);

  // Enhanced member search that excludes existing members
  useEffect(()=>{
    const t = setTimeout(()=>{
      if(query && project?.workspace) {
        api.get(`/contexts/users/search`, { 
          params: { 
            q: query,
            contextType: project.workspace.contextType,
            contextId: project.workspace.contextId
          } 
        }).then(r=>{
          // Filter out users who are already members of the project
          const currentMemberIds = new Set(allMembers.map(m => m._id));
          const filteredResults = r.data.filter((user: Member) => !currentMemberIds.has(user._id));
          setSearchResults(filteredResults);
        });
      } else {
        setSearchResults([]);
      }
    }, 250);
    return ()=>clearTimeout(t);
  }, [query, allMembers, project]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'high': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'low': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'in_progress': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'todo': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const tasksByStatus = useMemo(() => {
    const filteredTasks = filterAndSortTasks(tasks);
    return {
      todo: filteredTasks.filter(t => t.status === 'todo'),
      in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
      done: filteredTasks.filter(t => t.status === 'done')
    };
  }, [tasks, taskSearchQuery, taskFilters, taskSort]);

  return (
    <>
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
            <button 
              onClick={() => router.push('/dashboard')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0"
            >
              Dashboard
            </button>
            <span className="flex-shrink-0">›</span>
            <button 
              onClick={() => router.push('/workspaces')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0"
            >
              Workspaces
            </button>
            <span className="flex-shrink-0">›</span>
            {project?.workspace && (
              <>
                <button 
                  onClick={() => router.push(`/workspaces/${project.workspace._id}`)}
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0"
                >
                  {project.workspace.name}
                </button>
                <span className="flex-shrink-0">›</span>
              </>
            )}
            <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{project?.name}</span>
          </nav>

          {/* Project Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 truncate">{project?.name || 'Project'}</h1>
                {project?.description && (
                  <p className="text-gray-600 dark:text-gray-300 mb-2 text-sm sm:text-base">{project.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {project?.workspace && (
                    <span className="truncate">Workspace: {project.workspace.name}</span>
                  )}
                  {project?.startDate && (
                    <span className="whitespace-nowrap">Start: {new Date(project.startDate).toLocaleDateString()}</span>
                  )}
                  {project?.endDate && (
                    <span className="whitespace-nowrap">End: {new Date(project.endDate).toLocaleDateString()}</span>
                  )}
                  {project?.status && (
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      project.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                      project.status === 'planning' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                      project.status === 'on_hold' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                      project.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                      project.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                      {project.status.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                  {project?.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs whitespace-nowrap">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 items-center flex-shrink-0">
                <button
                  onClick={() => openTaskModalWithStatus('todo')}
                  className="bg-blue-600 dark:bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm sm:text-base whitespace-nowrap"
                >
                  + Add Task
                </button>

                {/* Project Menu */}
                {project && currentUser && (project.owner._id === currentUser._id || canUserDeleteProject) && (
                  <div className="relative project-menu-container">
                    <button
                      onClick={() => setShowProjectMenu(!showProjectMenu)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {showProjectMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[160px]">
                        {/* Edit option - only for project owner */}
                        {project.owner._id === currentUser._id && (
                          <button
                            onClick={openEditProjectModal}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Project
                          </button>
                        )}
                        
                        {/* Delete option - for users with delete permission */}
                        {canUserDeleteProject && (
                          <button
                            onClick={() => {
                              setShowProjectMenu(false);
                              setShowProjectDeleteConfirm(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Project
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Stats */}
          <div className="mt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{tasksByStatus.todo.length}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">To Do</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{tasksByStatus.in_progress.length}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">In Progress</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{tasksByStatus.done.length}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Done</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xl sm:text-2xl font-bold text-gray-600 dark:text-gray-400">{tasks.length}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
          </div>
            </div>
          </div>

        {/* Members Section */}
        <section className="mt-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="font-medium mb-4 text-sm sm:text-base text-gray-900 dark:text-gray-100">Team Members</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {allMembers.map(m => (
              <div key={m._id} className="relative">
                <span className="px-2 sm:px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs sm:text-sm truncate max-w-full inline-flex items-center gap-2">
                  <div className="relative">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    {/* Online status indicator */}
                    {isUserOnline(m._id) && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-green-400 border border-white dark:border-gray-700 rounded-full"></div>
                    )}
                  </div>
                  {m.name} ({m.email})
                  {/* Online status text indicator */}
                  {isUserOnline(m._id) && (
                    <span className="text-green-600 dark:text-green-400 text-xs">●</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="relative">
            <input 
              value={query} 
              onChange={e=>setQuery(e.target.value)} 
              placeholder="Search for new team members to add..." 
              className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 w-full text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400" 
            />
            {!!searchResults.length && (
              <div className="absolute top-full left-0 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 w-full bg-white dark:bg-gray-800 shadow-lg z-10 divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {searchResults.map(u => (
                  <button 
                    key={u._id} 
                    onClick={()=>addMember(u._id)} 
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm truncate text-gray-900 dark:text-gray-100"
                  >
                    {u.name} ({u.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Tasks Section */}
        <section className="mt-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Tasks</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 overflow-x-auto">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex-shrink-0">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                      viewMode === 'kanban' 
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
                    </svg>
                    <span className="hidden sm:inline">Board</span>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                      viewMode === 'list' 
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="hidden sm:inline">List</span>
                  </button>
                </div>

                {/* Search */}
                <div className="relative min-w-0 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    className="w-full sm:w-64 pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <svg className="w-4 h-4 absolute left-2.5 top-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Filter Buttons Row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {/* Filter Button */}
                  <div className="relative flex-shrink-0">
                    <button
                      data-filter-button
                      onClick={() => setShowTaskFilters(!showTaskFilters)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors whitespace-nowrap ${
                        showTaskFilters ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                      </svg>
                      <span className="hidden sm:inline">Filter</span>
                      {(taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length) > 0 && (
                        <span className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs px-1.5 py-0.5 rounded-full">
                          {taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length}
                        </span>
                      )}
                    </button>
                  </div>

                {/* Sort Button */}
                <div className="relative flex-shrink-0">
                  <button
                    data-filter-button
                    onClick={() => setShowTaskSort(!showTaskSort)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors whitespace-nowrap ${
                      showTaskSort ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    <span className="hidden sm:inline">Sort</span>
                  </button>
                </div>

                {/* Assignee Filter Button */}
                <div className="relative flex-shrink-0">
                  <button
                    data-filter-button
                    onClick={() => setShowAssigneeFilter(!showAssigneeFilter)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors whitespace-nowrap ${
                      showAssigneeFilter ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <span className="hidden sm:inline">Assignee</span>
                    {taskFilters.assignees.length > 0 && (
                      <span className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs px-1.5 py-0.5 rounded-full">
                        {taskFilters.assignees.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Clear Filters */}
                {(taskSearchQuery || taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length > 0) && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 whitespace-nowrap flex-shrink-0"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </div>

            {/* Results Summary */}
            {(taskSearchQuery || taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length > 0) && (
              <div className="text-sm text-gray-600 dark:text-gray-400 px-2">
                Showing {filterAndSortTasks(tasks).length} of {tasks.length} tasks
                {taskSearchQuery && <span> matching "{taskSearchQuery}"</span>}
              </div>
            )}

            {/* Filter Panels */}
            {showTaskFilters && (
              <div className="task-filters-container border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Status Filter */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Status</h4>
                    <div className="space-y-2">
                      {['todo', 'in_progress', 'done'].map(status => (
                        <label key={status} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={taskFilters.status.includes(status)}
                            onChange={() => toggleTaskFilter('status', status)}
                            className="mr-2"
                          />
                          <span className="text-sm capitalize text-gray-900 dark:text-gray-100">{status.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Priority Filter */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Priority</h4>
                    <div className="space-y-2">
                      {['low', 'medium', 'high', 'urgent'].map(priority => (
                        <label key={priority} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={taskFilters.priority.includes(priority)}
                            onChange={() => toggleTaskFilter('priority', priority)}
                            className="mr-2"
                          />
                          <span className="text-sm capitalize text-gray-900 dark:text-gray-100">{priority}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Due Date Range */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Due Date</h4>
                    <div className="space-y-2">
                      <input
                        type="date"
                        placeholder="Start date"
                        value={taskFilters.dueDateRange.start}
                        onChange={(e) => setTaskFilters(prev => ({
                          ...prev,
                          dueDateRange: { ...prev.dueDateRange, start: e.target.value }
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm"
                      />
                      <input
                        type="date"
                        placeholder="End date"
                        value={taskFilters.dueDateRange.end}
                        onChange={(e) => setTaskFilters(prev => ({
                          ...prev,
                          dueDateRange: { ...prev.dueDateRange, end: e.target.value }
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm"
                      />
                    </div>
                  </div>

                  {/* Quick Filters */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Quick Filters</h4>
                    <div className="space-y-2">
                      <button
                        onClick={() => setTaskFilters(prev => ({
                          ...prev,
                          dueDateRange: {
                            start: new Date().toISOString().split('T')[0],
                            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                          }
                        }))}
                        className="w-full text-left px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
                      >
                        Due this week
                      </button>
                      <button
                        onClick={() => toggleTaskFilter('assignees', 'unassigned')}
                        className="w-full text-left px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
                      >
                        Unassigned
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sort Panel */}
            {showTaskSort && (
              <div className="task-filters-container border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Sort By</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { field: 'title', label: 'Task Name' },
                    { field: 'priority', label: 'Priority' },
                    { field: 'dueDate', label: 'Due Date' },
                    { field: 'assignee', label: 'Assignee' },
                    { field: 'dateCreated', label: 'Date Created' },
                    { field: 'dateUpdated', label: 'Date Updated' }
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => toggleTaskSort(field as any)}
                      className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-colors ${
                        taskSort.field === field
                          ? 'bg-blue-100 dark:bg-blue-800 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-200'
                          : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500'
                      }`}
                    >
                      <span>{label}</span>
                      {taskSort.field === field && (
                        <svg
                          className={`w-4 h-4 transition-transform ${
                            taskSort.direction === 'desc' ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignee Filter Panel */}
            {showAssigneeFilter && (
              <div className="task-filters-container border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Assignees</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={taskFilters.assignees.includes('unassigned')}
                      onChange={() => toggleTaskFilter('assignees', 'unassigned')}
                      className="mr-2"
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">Unassigned</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({tasks.filter(t => t.assignees.length === 0).length})
                      </span>
                    </div>
                  </label>
                  {allMembers.map(member => (
                    <label key={member._id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={taskFilters.assignees.includes(member._id)}
                        onChange={() => toggleTaskFilter('assignees', member._id)}
                        className="mr-2"
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{member.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({tasks.filter(t => t.assignees.some(a => a._id === member._id)).length})
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Task Views */}
          {viewMode === 'kanban' ? (
            // Kanban Board View
            isClient ? (
              <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex flex-col md:grid md:grid-cols-3 gap-8 overflow-x-auto md:overflow-x-visible">
                  {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
                    <div key={status} className="space-y-3 min-w-[280px] md:min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                          {status.replace('_', ' ')}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{statusTasks.length}</span>
                      </div>
                      
                      <Droppable droppableId={status}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`space-y-4 min-h-[200px] p-3 rounded-lg transition-colors ${
                              snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900 border-2 border-blue-200 dark:border-blue-600 border-dashed' : 'bg-gray-50 dark:bg-gray-700'
                            }`}
                          >
                            {statusTasks.map((task, index) => (
                              <Draggable key={task._id} draggableId={task._id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 sm:p-5 transition-shadow cursor-pointer select-none ${
                                      snapshot.isDragging 
                                        ? 'shadow-lg rotate-2 border-blue-300 dark:border-blue-500' 
                                        : 'hover:shadow-md'
                                    }`}
                                    onClick={() => openTaskDetail(task)}
                                  >
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 text-sm sm:text-base">{task.title}</h4>
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
                                      <span className={`px-2 py-1 rounded text-xs font-medium w-fit ${getPriorityColor(task.priority)}`}>
                                        {task.priority}
                                      </span>
                                      {task.dueDate && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          Due {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {task.assignees.length > 0 && (
                                      <div className="flex gap-2 mb-3">
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
                                    
                                    <div className="flex flex-wrap gap-2 sm:gap-3 mt-4">
                                      {status !== 'todo' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateTaskStatus(task._id, 'todo');
                                          }}
                                          className="text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600 whitespace-nowrap transition-colors"
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
                                          className="text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600 whitespace-nowrap transition-colors"
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
                                          className="text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600 whitespace-nowrap transition-colors"
                                        >
                                          Done
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => quickDeleteTask(task._id, e)}
                                        className="text-xs px-3 py-2 border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-800 whitespace-nowrap transition-colors"
                                        title="Delete task"
                                      >
                                        <Icons.Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            
                            {statusTasks.length === 0 && (
                              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                {(taskSearchQuery || taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length > 0) 
                                  ? `No ${status.replace('_', ' ')} tasks match your filters`
                                  : `No ${status.replace('_', ' ')} tasks`
                                }
                              </div>
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              </DragDropContext>
            ) : (
              <div className="flex flex-col md:grid md:grid-cols-3 gap-8 overflow-x-auto md:overflow-x-visible">
                {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
                  <div key={status} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {status.replace('_', ' ')}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{statusTasks.length}</span>
                    </div>
                    
                    <div className="space-y-4 min-h-[200px] p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                      {statusTasks.map((task) => (
                        <div
                          key={task._id}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 sm:p-5 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => openTaskDetail(task)}
                        >
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{task.title}</h4>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            {task.dueDate && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
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
                                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
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
                                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
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
                                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                              >
                                Done
                              </button>
                            )}
                            <button
                              onClick={(e) => quickDeleteTask(task._id, e)}
                              className="text-xs px-2 py-1 border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-800"
                              title="Delete task"
                            >
                              <Icons.Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {statusTasks.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          {(taskSearchQuery || taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length > 0) 
                            ? `No ${status.replace('_', ' ')} tasks match your filters`
                            : `No ${status.replace('_', ' ')} tasks`
                          }
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // List View - Grouped by Status
            <div className="space-y-2">
              {/* List Header */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Assignee</div>
                <div className="col-span-1">Start date</div>
                <div className="col-span-1">Due date</div>
                <div className="col-span-1">Priority</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2">Business Area</div>
              </div>

              {/* Grouped Task List */}
              {Object.entries(tasksByStatus).map(([status, statusTasks]) => {
                const isCollapsed = collapsedSections[status];
                const statusDisplayName = status.replace('_', ' ').split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
                
                return (
                  <div key={status} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    {/* Section Header */}
                    <div 
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => toggleSectionCollapse(status)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="flex items-center justify-center w-5 h-5 rounded transition-transform">
                          <svg 
                            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {/* Status Badge */}
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          status === 'done' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                          status === 'in_progress' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                          'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        }`}>
                          {statusDisplayName}
                        </span>
                        
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {statusTasks.length}
                        </span>
                      </div>
                      
                      <button 
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent section collapse
                          openTaskModalWithStatus(status as Task['status']);
                        }}
                        title={`Add task to ${statusDisplayName}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>

                    {/* Section Content */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {statusTasks.length > 0 ? (
                          statusTasks.map((task, index) => (
                            <div
                              key={task._id}
                              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                              onClick={() => openTaskDetail(task)}
                            >
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                {/* Task Name */}
                                <div className="col-span-1 md:col-span-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</h4>
                                    </div>
                                  </div>
                                </div>

                                {/* Assignee */}
                                <div className="col-span-1 md:col-span-2">
                                  <div className="flex items-center gap-2">
                                    {task.assignees.length > 0 ? (
                                      <>
                                        <div className="flex -space-x-1">
                                          {task.assignees.slice(0, 2).map(assignee => (
                                            <div
                                              key={assignee._id}
                                              className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs border-2 border-white dark:border-gray-800"
                                              title={assignee.name}
                                            >
                                              {assignee.name.charAt(0).toUpperCase()}
                                            </div>
                                          ))}
                                          {task.assignees.length > 2 && (
                                            <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs border-2 border-white dark:border-gray-800">
                                              +{task.assignees.length - 2}
                                            </div>
                                          )}
                                        </div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                                          {task.assignees[0].name}
                                          {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                                        </span>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                        </div>
                                        <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Unassigned</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Start Date */}
                                <div className="col-span-1 md:col-span-1">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {task.createdAt ? new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                                  </span>
                                </div>

                                {/* Due Date */}
                                <div className="col-span-1 md:col-span-1">
                                  <span className={`text-sm ${
                                    task.dueDate && new Date(task.dueDate) < new Date() 
                                      ? 'text-red-600 dark:text-red-400' 
                                      : 'text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                                  </span>
                                </div>

                                {/* Priority */}
                                <div className="col-span-1 md:col-span-1">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    task.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                                    task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' :
                                    task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                                    'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                  }`}>
                                    {task.priority === 'urgent' && '🔴'}
                                    {task.priority === 'high' && '🟠'}
                                    {task.priority === 'medium' && '🟡'}
                                    {task.priority === 'low' && '🟢'}
                                    <span className="ml-1 capitalize">{task.priority}</span>
                                  </span>
                                </div>

                                {/* Status */}
                                <div className="col-span-1 md:col-span-1">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${
                                    task.status === 'todo' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                                    task.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                                    'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                  }`}>
                                    {task.status === 'todo' && '⏳'}
                                    {task.status === 'in_progress' && '🔄'}
                                    {task.status === 'done' && '✅'}
                                    <span className="ml-1">{task.status.replace('_', ' ')}</span>
                                  </span>
                                </div>

                                {/* Business Area */}
                                <div className="col-span-1 md:col-span-2">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                    Development
                                  </span>
                                </div>
                              </div>

                              {/* Mobile Actions */}
                              <div className="flex gap-2 mt-3 md:hidden">
                                {task.status !== 'todo' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTaskStatus(task._id, 'todo');
                                    }}
                                    className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                                  >
                                    Todo
                                  </button>
                                )}
                                {task.status !== 'in_progress' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTaskStatus(task._id, 'in_progress');
                                    }}
                                    className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                                  >
                                    In Progress
                                  </button>
                                )}
                                {task.status !== 'done' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTaskStatus(task._id, 'done');
                                    }}
                                    className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                                  >
                                    Done
                                  </button>
                                )}
                                <button
                                  onClick={(e) => quickDeleteTask(task._id, e)}
                                  className="text-xs px-2 py-1 border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-800"
                                  title="Delete task"
                                >
                                  <Icons.Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            {(taskSearchQuery || taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length > 0) 
                              ? `No ${statusDisplayName.toLowerCase()} tasks match your filters`
                              : `No ${statusDisplayName.toLowerCase()} tasks`
                            }
                          </div>
                        )}

                        {/* Add Task Button */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                          <button 
                            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                            onClick={() => openTaskModalWithStatus(status as Task['status'])}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Task
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty State */}
              {Object.values(tasksByStatus).every(statusTasks => statusTasks.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {(taskSearchQuery || taskFilters.status.length + taskFilters.priority.length + taskFilters.assignees.length > 0) 
                    ? 'No tasks match your filters'
                    : 'No tasks created yet'
                  }
                </div>
              )}
            </div>
          )}
        </section>

        {/* Create Task Modal */}
        {showTaskModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create New Task</h2>
                  <button
                    onClick={() => {
                      setShowTaskModal(false);
                      setError('');
                      setTitle('');
                      setDescription('');
                      setDefaultTaskStatus('todo'); // Reset to default
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={createTask} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Enter task title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Enter task description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Task['priority'])}
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        value={defaultTaskStatus}
                        onChange={(e) => setDefaultTaskStatus(e.target.value as Task['status'])}
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          <span className="text-sm text-gray-900 dark:text-gray-100">{member.name} ({member.email})</span>
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
                        setDefaultTaskStatus('todo'); // Reset to default
                      }}
                      className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 dark:bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
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
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                          <button
                            onClick={() => saveField('priority')}
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm p-1 hover:bg-green-50 dark:hover:bg-green-900 rounded"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => cancelEditing('priority')}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm p-1 hover:bg-red-50 dark:hover:bg-red-900 rounded"
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
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          <button
                            onClick={() => saveField('status')}
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm p-1 hover:bg-green-50 dark:hover:bg-green-900 rounded"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => cancelEditing('status')}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm p-1 hover:bg-red-50 dark:hover:bg-red-900 rounded"
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
                          className="text-3xl font-bold text-gray-900 dark:text-gray-100 border-none focus:outline-none bg-transparent flex-1 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                          autoFocus
                        />
                        <button
                          onClick={() => saveField('title')}
                          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 p-2 hover:bg-green-50 dark:hover:bg-green-900 rounded"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => cancelEditing('title')}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing('title')}
                        className="text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 w-full group mb-4 transition-colors"
                      >
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {selectedTask.title} 
                          <Icons.Edit className="opacity-0 group-hover:opacity-100 w-5 h-5 ml-2 text-gray-400 dark:text-gray-500" />
                        </h1>
                      </button>
                    )}
                    
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <span>Created by</span>
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                        {selectedTask.createdBy.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{selectedTask.createdBy.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors"
                      title="Delete task"
                    >
                      <Icons.Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setShowTaskDetail(false)}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
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
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Description</h3>
                      {isEditing.description ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValues.description}
                            onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-full text-left bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 group"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-gray-700 dark:text-gray-300">
                              {selectedTask.description || 'No description provided'}
                            </span>
                            <Icons.Edit className="opacity-0 group-hover:opacity-100 w-4 h-4 text-sm" />
                          </div>
                        </button>
                      )}
                    </div>
                    {/* Documents Section */}
                    <div className="space-y-4 size-y-6">
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                        <TaskDocuments
                          taskId={selectedTask._id}
                          canEdit={true}
                          className=""
                        />
                      </div>
                    </div>
                    
                    {/* Comments */}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Comments</h3>
                      
                      <form onSubmit={addComment} className="mb-4 relative">
                        <textarea
                          value={newComment}
                          onChange={handleCommentChange}
                          placeholder="Add a comment... (type @ to mention someone)"
                          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                        
                        {/* Mention Suggestions */}
                        {showMentions && mentionSuggestions.length > 0 && (
                          <div className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-32 overflow-y-auto z-10">
                            {mentionSuggestions.map(member => (
                              <button
                                key={member._id}
                                type="button"
                                onClick={() => insertMention(member)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                              >
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
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
                          <div key={comment._id} className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                                  {comment.author?.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{comment.author?.name || 'Unknown User'}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Comment Menu - Only show for comment author */}
                              {currentUser && comment.author?._id === currentUser._id && (
                                <div className="relative comment-menu-container">
                                  <button
                                    onClick={() => toggleCommentMenu(comment._id)}
                                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                  </button>
                                  
                                  {showCommentMenu[comment._id] && (
                                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                                      <button
                                        onClick={() => startEditingComment(comment)}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setShowCommentMenu({});
                                          setShowCommentDeleteConfirm(comment._id);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Comment Content */}
                            {editingComment === comment._id ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editCommentContent}
                                  onChange={(e) => setEditCommentContent(e.target.value)}
                                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={saveCommentEdit}
                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditingComment}
                                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-gray-700 dark:text-gray-300 mb-3">{renderCommentContent(comment.content)}</p>
                                
                                {/* Emoji Reactions */}
                                <div className="flex flex-wrap gap-2 items-center">
                                  {/* Existing Reactions */}
                                  {comment.reactions?.filter(r => r.count > 0).map((reaction, index) => {
                                    // Get the names of users who reacted with this emoji
                                    const reactorNames = reaction.users?.map((user: any) => {
                                      // Handle both populated user objects and user IDs
                                      if (typeof user === 'object' && user.name) {
                                        return user.name;
                                      } else if (typeof user === 'string') {
                                        // Fallback to finding user in allMembers if it's just an ID
                                        const member = allMembers.find(member => member._id === user || member.id === user);
                                        return member?.name || 'Unknown User';
                                      }
                                      return 'Unknown User';
                                    }).filter(Boolean) || [];
                                    
                                    const tooltipText = reactorNames.length > 0 
                                      ? `${reactorNames.join(', ')} reacted with ${reaction.emoji}`
                                      : `${reaction.count} reaction${reaction.count > 1 ? 's' : ''} with ${reaction.emoji}`;

                                    return (
                                      <button
                                        key={`${reaction.emoji}-${index}`}
                                        onClick={() => addReaction(comment._id, reaction.emoji)}
                                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-full text-sm transition-colors group relative"
                                        title={tooltipText}
                                      >
                                        <span>{reaction.emoji}</span>
                                        <span className="text-xs text-gray-600 dark:text-gray-300">{reaction.count}</span>
                                        
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-30">
                                          {tooltipText}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                  
                                  {/* Add Reaction Button */}
                                  <div className="relative emoji-picker-container">
                                    <button
                                      onClick={() => toggleEmojiPicker(comment._id)}
                                      className="flex items-center gap-1 px-2 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full text-sm transition-colors"
                                      title="Add reaction"
                                    >
                                      <Icons.Smile className="w-5 h-5" />
                                      <span className="text-xs">Add</span>
                                    </button>
                                    
                                    {/* Emoji Picker Dropdown */}
                                    {showEmojiPicker[comment._id] && (
                                      <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 z-20 min-w-[200px]">
                                        <div className="grid grid-cols-5 gap-1">
                                          {[
                                            '👍', '👎', '❤️', '😊', '😢', 
                                            '😡', '🎉', '🔥', '💯', '🚀',
                                            '�', '💪', '🤔', '😍', '🤯'
                                          ].map(emoji => (
                                            <button
                                              key={emoji}
                                              onClick={() => addReaction(comment._id, emoji)}
                                              className="w-10 h-10 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md flex items-center justify-center text-xl transition-colors border-0 p-1"
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
                              </>
                            )}
                          </div>
                        ))}
                        {comments.length === 0 && (
                          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No comments yet</p>
                        )}
                      </div>
                    </div>

                    {/* Activity Section */}
                    <TaskActivity 
                      taskId={selectedTask._id} 
                      onActivitiesLoad={handleActivitiesLoad}
                    />
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Assignees */}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Assignees</h3>
                      
                      {/* Add Assignee Search */}
                      <div className="mb-4">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search for users to assign..."
                            value={assigneeSearchQuery}
                            onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          
                          {/* Search Results Dropdown */}
                          {assigneeSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                              {assigneeSearchResults.map(user => (
                                <button
                                  key={user._id}
                                  onClick={() => addAssignee(selectedTask._id, user._id)}
                                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-600 text-left border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                                  disabled={selectedTask.assignees.some(a => a._id === user._id)}
                                >
                                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
                                  </div>
                                  {selectedTask.assignees.some(a => a._id === user._id) && (
                                    <span className="ml-auto text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900 px-2 py-1 rounded">Already assigned</span>
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
                            <div key={assignee._id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                  {assignee.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{assignee.name}</span>
                                {currentUser && assignee._id === currentUser._id && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900 px-2 py-1 rounded">Me</span>
                                )}
                              </div>
                              <button
                                onClick={() => removeAssignee(selectedTask._id, assignee._id)}
                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm p-1 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-sm py-2">No assignees</p>
                        )}
                      </div>
                    </div>

                    {/* Watchers */}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">👀 Watchers</h3>
                      
                      {/* Current User Watch/Unwatch Toggle - Only show if not watching */}
                      {currentUser && !selectedTask.watchers.some(w => w._id === currentUser._id) && (
                        <div className="mb-4">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-lg">👁</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Watch</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Get notified of all activity on this task.</p>
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
                            <Icons.Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search or enter name/email..."
                            value={watcherSearchQuery}
                            onChange={(e) => setWatcherSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        
                        {/* Watcher Search Results */}
                        {watcherSearchResults.length > 0 && (
                          <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 shadow-sm">
                            {watcherSearchResults.map(user => (
                              <button
                                key={user._id}
                                onClick={() => addWatcher(selectedTask._id, user._id)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-600 text-left"
                                disabled={selectedTask.watchers.some(w => w._id === user._id)}
                              >
                                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                                </div>
                                {selectedTask.watchers.some(w => w._id === user._id) && (
                                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Already watching</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Current Watchers List */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Watchers</h4>
                        {selectedTask.watchers.length > 0 ? (
                          selectedTask.watchers.map(watcher => (
                            <div key={watcher._id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                                  {watcher.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{watcher.name}</span>
                                {currentUser && watcher._id === currentUser._id && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900 px-2 py-1 rounded">Me</span>
                                )}
                              </div>
                              <button
                                onClick={() => removeWatcher(selectedTask._id, watcher._id)}
                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm p-1 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-sm py-2">No watchers</p>
                        )}
                      </div>
                    </div>

                    {/* Due Date */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">Due Date</h3>
                        {!isEditing.dueDate && (
                          <button
                            onClick={() => startEditing('dueDate')}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            <Icons.Edit className="w-4 h-4 inline mr-1" /> Edit
                          </button>
                        )}
                      </div>
                      
                      {isEditing.dueDate ? (
                        <div className="space-y-2">
                          <input
                            type="date"
                            value={editValues.dueDate}
                            onChange={(e) => setEditValues(prev => ({ ...prev, dueDate: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">
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

        {/* Edit Project Modal */}
        {showEditProjectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Project</h2>
                  <button
                    onClick={() => setShowEditProjectModal(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={updateProject} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={projectEditForm.name}
                      onChange={(e) => setProjectEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter project name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={projectEditForm.description}
                      onChange={(e) => setProjectEditForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter project description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        value={projectEditForm.status}
                        onChange={(e) => setProjectEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={projectEditForm.startDate}
                        onChange={(e) => setProjectEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={projectEditForm.endDate}
                        onChange={(e) => setProjectEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {projectEditForm.tags.map(tag => (
                        <span
                          key={tag}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center gap-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Add a tag and press Enter"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            addTag(input.value);
                            input.value = '';
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowEditProjectModal(false)}
                      className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    >
                      Update Project
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icons.AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Delete Task
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete <span className="font-semibold">"{selectedTask.title}"</span>? 
                    This will permanently delete the task, all its comments, and activity history.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteTask}
                    disabled={isDeleting}
                    className="flex-1 bg-red-600 dark:bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Icons.Trash2 className="w-4 h-4" />
                        Delete Task
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Delete Confirmation Modal */}
        {showProjectDeleteConfirm && project && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icons.AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Delete Project
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete <span className="font-semibold">"{project.name}"</span>? 
                    This will permanently delete the project, all its tasks, comments, and activity history.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProjectDeleteConfirm(false)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    disabled={isDeletingProject}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteProject}
                    disabled={isDeletingProject}
                    className="flex-1 bg-red-600 dark:bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeletingProject ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Icons.Trash2 className="w-4 h-4" />
                        Delete Project
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comment Delete Confirmation Modal */}
        {showCommentDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icons.AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Delete Comment
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete this comment? This will permanently remove the comment and its reactions.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCommentDeleteConfirm(null)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    disabled={isDeletingComment}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteComment(showCommentDeleteConfirm)}
                    disabled={isDeletingComment}
                    className="flex-1 bg-red-600 dark:bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeletingComment ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Icons.Trash2 className="w-4 h-4" />
                        Delete Comment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
