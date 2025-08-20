'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useSocket } from '../../../contexts/SocketContext';

interface Member {
  _id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface Organization {
  _id: string;
  name: string;
  description?: string;
}



export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({
    email: '',
    role: 'member' as 'admin' | 'member'
  });
  const [addingMember, setAddingMember] = useState(false);
  const router = useRouter();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const { isUserOnline, joinOrganization, leaveOrganization } = useSocket();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);



  useEffect(() => {
    fetchCurrentOrganization();
    
    // Cleanup function to leave organization room
    return () => {
      if (currentOrgId) {
        console.log('Leaving organization room on cleanup:', currentOrgId);
        leaveOrganization(currentOrgId);
      }
    };
  }, [currentOrgId, leaveOrganization]);

  // Listen for context changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      fetchCurrentOrganization();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom context change events
    const handleContextChange = () => {
      fetchCurrentOrganization();
    };
    
    window.addEventListener('contextChanged', handleContextChange);

    // Listen for popstate events (browser back/forward navigation)
    const handlePopState = () => {
      fetchCurrentOrganization();
    };
    
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('contextChanged', handleContextChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const fetchCurrentOrganization = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      // First check localStorage for the last active context
      const lastActiveContext = localStorage.getItem('lastActiveContext');
      let contextData = null;
      
      if (lastActiveContext) {
        try {
          contextData = JSON.parse(lastActiveContext);
        } catch (e) {
          console.warn('Failed to parse lastActiveContext from localStorage');
        }
      }

      // If no context in localStorage, get from user data
      if (!contextData) {
        const userResponse = await api.get('/auth/me');
        const userData = userResponse.data.user || userResponse.data;
        contextData = userData.lastActiveContext;
      }

      // Check if user is in an organization context
      if (!contextData || contextData.type !== 'organization') {
        setError('This page is only available when you are in an organization context. Please switch to an organization first from the sidebar.');
        setLoading(false);
        return;
      }

      // Update backend with current context to ensure sync
      try {
        await api.put('/contexts/context', {
          type: contextData.type,
          id: contextData.id
        });
      } catch (contextErr) {
        console.warn('Failed to update context in backend:', contextErr);
      }

      // Get organization details
      const orgResponse = await api.get('/contexts/organizations');
      const organizations = orgResponse.data;
      const currentOrg = organizations.find((org: any) => org._id === contextData.id);

      if (!currentOrg) {
        setError('Organization not found or access denied');
        setLoading(false);
        return;
      }

      setOrganization(currentOrg);

      // Get current user's role in this organization
      const userResponse = await api.get('/auth/me');
      const userData = userResponse.data.user || userResponse.data;
      const currentMember = currentOrg.members?.find((member: any) => 
        member.userId === userData._id || member.userId === userData.id
      );
      
      if (currentMember) {
        setCurrentUserRole(currentMember.role);
      }

      // Fetch members
      await fetchMembers(contextData.id);
      
      // Join organization room for real-time updates only if changed
      if (currentOrgId !== contextData.id) {
        if (currentOrgId) {
          console.log('Leaving previous organization room:', currentOrgId);
          leaveOrganization(currentOrgId);
        }
        
        console.log('Joining organization room:', contextData.id);
        joinOrganization(contextData.id);
        setCurrentOrgId(contextData.id);
      }
    } catch (err) {
      console.error('Error fetching organization:', err);
      if (err instanceof Error && err.message.includes('403')) {
        setError('Access denied to this organization. Please switch to an organization you have access to.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch organization data');
      }
      setLoading(false);
    }
  };

  const fetchMembers = async (organizationId: string) => {
    try {
      const response = await api.get(`/contexts/members?contextType=organization&contextId=${organizationId}`);
      const data = response.data;
      setMembers(data.members);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching members:', err);
      if (err instanceof Error && err.message.includes('403')) {
        setError('Access denied to this organization. Please switch to an organization you have access to.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch members');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    if (currentUserRole !== 'owner') {
      setError('Only organization owners can change member roles');
      return;
    }

    setUpdatingMember(memberId);
    try {
      await api.patch(`/contexts/organizations/${organization?._id}/members/${memberId}`, {
        role: newRole
      });

      // Refresh members list
      await fetchMembers(organization!._id);
    } catch (err) {
      console.error('Error updating member role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update member role');
    } finally {
      setUpdatingMember(null);
    }
  };

  const removeMember = async (memberId: string) => {
    if (currentUserRole !== 'owner') {
      setError('Only organization owners can remove members');
      return;
    }

    if (!confirm('Are you sure you want to remove this member from the organization?')) {
      return;
    }

    try {
      await api.delete(`/contexts/organizations/${organization?._id}/members/${memberId}`);

      // Refresh members list
      await fetchMembers(organization!._id);
    } catch (err) {
      console.error('Error removing member:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const addMember = async () => {
    if (!organization || !['owner', 'admin'].includes(currentUserRole)) {
      setError('Only organization owners and admins can add members');
      return;
    }

    if (!addMemberForm.email.trim()) {
      setError('Email is required');
      return;
    }

    setAddingMember(true);
    try {
      await api.post(`/contexts/organizations/${organization._id}/members`, {
        email: addMemberForm.email.trim(),
        role: addMemberForm.role
      });

      // Reset form and close modal
      setAddMemberForm({ email: '', role: 'member' });
      setShowAddMemberModal(false);
      setError('');

      // Refresh members list
      await fetchMembers(organization._id);
    } catch (err: any) {
      console.error('Error adding member:', err);
      setError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'member':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <>
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Organization Context Required
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Go to Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setError('');
                        setLoading(true);
                        fetchCurrentOrganization();
                      }}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            </div>
      </>
    );
  }

  return (
    <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Organization Members
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Manage members and their roles in <span className="font-semibold">{organization?.name}</span>
                </p>
              </div>
              
              {/* Add Member Button - Only show for owners and admins */}
              {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Member
                </button>
              )}
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {members.map((member) => (
                <li key={member._id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 relative">
                        <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {/* Online status indicator */}
                        {isUserOnline(member._id) && (
                          <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-400 border-2 border-white dark:border-gray-800 rounded-full"></div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {member.name}
                          </p>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                            {member.role}
                          </span>
                          {/* Online status text indicator */}
                          {isUserOnline(member._id) && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                              Online
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {member.email}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Role Management - Only show for owners */}
                    {currentUserRole === 'owner' && member.role !== 'owner' && (
                      <div className="flex items-center space-x-2">
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member._id, e.target.value as 'admin' | 'member')}
                          disabled={updatingMember === member._id}
                          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => removeMember(member._id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {/* Show updating indicator */}
                    {updatingMember === member._id && (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-500">Updating...</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {members.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No members</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Get started by adding members to your organization.
                </p>
              </div>
            )}
          </div>

          {/* Role Permissions Info */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Role Permissions
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Owner:</strong> Full access to manage organization, members, and all workspaces</li>
                    <li><strong>Admin:</strong> Can manage workspaces and projects, but cannot manage organization members</li>
                    <li><strong>Member:</strong> Can access assigned workspaces and projects, limited management permissions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Add Member Modal */}
          {showAddMemberModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Add New Member
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddMemberModal(false);
                        setAddMemberForm({ email: '', role: 'member' });
                        setError('');
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-3">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={addMemberForm.email}
                      onChange={(e) => setAddMemberForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter member's email address"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Role
                    </label>
                    <select
                      value={addMemberForm.role}
                      onChange={(e) => setAddMemberForm(prev => ({ ...prev, role: e.target.value as 'admin' | 'member' }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {addMemberForm.role === 'admin' 
                        ? 'Admins can manage workspaces and projects, but not organization members'
                        : 'Members can access assigned workspaces with limited permissions'
                      }
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setAddMemberForm({ email: '', role: 'member' });
                      setError('');
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addMember}
                    disabled={addingMember || !addMemberForm.email.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
