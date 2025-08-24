'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';

interface Member {
  _id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface Organization {
  _id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{
    userId: Member;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
  }>;
}

interface OrganizationMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization | null;
  onUpdate: () => void;
}

export default function OrganizationMembersModal({
  isOpen,
  onClose,
  organization,
  onUpdate,
}: OrganizationMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add member form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'admin'>('member');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    if (isOpen && organization) {
      loadMembers();
    }
  }, [isOpen, organization]);

  const loadMembers = async () => {
    if (!organization) return;

    setLoading(true);
    try {
      const response = await api.get(
        `/contexts/members?contextType=organization&contextId=${organization._id}`
      );
      setMembers(response.data.members);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !newMemberEmail.trim()) return;

    setAddingMember(true);
    setError('');

    try {
      await api.post(`/contexts/organizations/${organization._id}/members`, {
        email: newMemberEmail.trim(),
        role: newMemberRole,
      });

      setNewMemberEmail('');
      setNewMemberRole('member');
      setShowAddForm(false);
      await loadMembers();
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!organization || !confirm('Are you sure you want to remove this member?')) return;

    try {
      await api.delete(`/contexts/organizations/${organization._id}/members/${memberId}`);
      await loadMembers();
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'member' | 'admin') => {
    if (!organization) return;

    try {
      await api.patch(`/contexts/organizations/${organization._id}/members/${memberId}`, {
        role: newRole,
      });
      await loadMembers();
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update role');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const canManageMembers = () => {
    if (!organization) return false;
    const currentUser = members.find(m => m.role === 'owner' || m.role === 'admin');
    return !!currentUser;
  };

  if (!organization) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage ${organization.name} Members`}
      size='lg'
    >
      <div className='space-y-6'>
        {error && (
          <div className='p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg'>
            <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
          </div>
        )}

        {/* Add Member Section */}
        {canManageMembers() && (
          <div className='border-b border-gray-200 dark:border-gray-700 pb-4'>
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
              >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                  />
                </svg>
                Add Member
              </button>
            ) : (
              <form
                onSubmit={handleAddMember}
                className='space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'
              >
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Email Address
                  </label>
                  <input
                    type='email'
                    value={newMemberEmail}
                    onChange={e => setNewMemberEmail(e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    placeholder="Enter user's email address"
                    required
                    disabled={addingMember}
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Role
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={e => setNewMemberRole(e.target.value as 'member' | 'admin')}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    disabled={addingMember}
                  >
                    <option value='member'>Member</option>
                    <option value='admin'>Admin</option>
                  </select>
                </div>
                <div className='flex gap-2'>
                  <button
                    type='submit'
                    disabled={addingMember || !newMemberEmail.trim()}
                    className='px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setShowAddForm(false);
                      setNewMemberEmail('');
                      setNewMemberRole('member');
                      setError('');
                    }}
                    className='px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors'
                    disabled={addingMember}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Members List */}
        <div>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
            Members ({members.length})
          </h3>

          {loading ? (
            <div className='text-center py-8'>
              <div className='inline-flex items-center gap-2 text-gray-500'>
                <svg
                  className='animate-spin h-5 w-5'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  ></circle>
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  ></path>
                </svg>
                Loading members...
              </div>
            </div>
          ) : (
            <div className='space-y-3'>
              {members.map(member => (
                <div
                  key={member._id}
                  className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'
                >
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium'>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className='font-medium text-gray-900 dark:text-white'>{member.name}</div>
                      <div className='text-sm text-gray-500 dark:text-gray-400'>{member.email}</div>
                    </div>
                  </div>

                  <div className='flex items-center gap-3'>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}
                    >
                      {member.role}
                    </span>

                    {canManageMembers() && member.role !== 'owner' && (
                      <div className='flex items-center gap-1'>
                        {member.role !== 'admin' && (
                          <button
                            onClick={() => handleUpdateRole(member._id, 'admin')}
                            className='p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded'
                            title='Promote to Admin'
                          >
                            <svg
                              className='w-4 h-4'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M5 10l7-7m0 0l7 7m-7-7v18'
                              />
                            </svg>
                          </button>
                        )}
                        {member.role === 'admin' && (
                          <button
                            onClick={() => handleUpdateRole(member._id, 'member')}
                            className='p-1 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900 rounded'
                            title='Demote to Member'
                          >
                            <svg
                              className='w-4 h-4'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M19 14l-7 7m0 0l-7-7m7 7V3'
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveMember(member._id)}
                          className='p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded'
                          title='Remove Member'
                        >
                          <svg
                            className='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M6 18L18 6M6 6l12 12'
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
