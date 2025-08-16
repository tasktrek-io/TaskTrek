'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DeleteAccountModal from '../../../components/DeleteAccountModal';
import { api } from '../../../lib/api';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { Icons } from '../../../lib/icons';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  lastActiveContext?: {
    type: 'personal' | 'organization';
    id: string;
  };
}



interface Organization {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  ownerId: string;
  members: Array<{
    userId: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
  }>;
  userRole?: 'owner' | 'admin' | 'member';
}

export default function ProfilePage() {
  const router = useRouter();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    avatar: ''
  });
  const [updating, setUpdating] = useState(false);
  const [leavingOrgId, setLeavingOrgId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);



  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Load user profile
      const userResponse = await api.get('/auth/me');
      const userData = userResponse.data.user || userResponse.data;
      setUser(userData);
      setEditForm({
        name: userData.name,
        phone: userData.phone || '',
        avatar: userData.avatar || ''
      });

      // Load organizations user belongs to
      const orgsResponse = await api.get('/contexts/organizations');
      const userOrganizations = orgsResponse.data.map((org: any) => ({
        ...org,
        userRole: org.ownerId === userData._id ? 'owner' : 
                 org.members?.find((m: any) => m.userId === userData._id)?.role || 'member'
      }));
      
      setOrganizations(userOrganizations);

    } catch (err) {
      console.error('Error loading profile data:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setUpdating(true);
      
      await api.patch('/auth/profile', {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        avatar: editForm.avatar.trim()
      });

      // Reload user data
      const userResponse = await api.get('/auth/me');
      const userData = userResponse.data.user || userResponse.data;
      setUser(userData);
      setIsEditing(false);
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({
      name: user?.name || '',
      phone: user?.phone || '',
      avatar: user?.avatar || ''
    });
    setIsEditing(false);
    setError('');
  };

  const getJoinDate = () => {
    if (!user?.createdAt) return 'Unknown';
    return new Date(user.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleLeaveOrganization = async (orgId: string) => {
    if (!user) return;
    
    try {
      setLeavingOrgId(orgId);
      await api.delete(`/contexts/organizations/${orgId}/leave`);
      
      // Refresh organizations list
      const orgsResponse = await api.get('/contexts/organizations');
      const userOrganizations = orgsResponse.data.map((org: any) => ({
        ...org,
        userRole: org.ownerId === user._id ? 'owner' : 
                 org.members?.find((m: any) => m.userId === user._id)?.role || 'member'
      }));
      
      setOrganizations(userOrganizations);
    } catch (err: any) {
      console.error('Error leaving organization:', err);
      setError(err.response?.data?.message || 'Failed to leave organization');
    } finally {
      setLeavingOrgId(null);
    }
  };

  const handleAccountDeleted = () => {
    // Clear any local storage, cookies, etc.
    localStorage.clear();
    // Redirect to home/login page
    router.push('/auth/login');
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

  return (
    <>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Profile
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Manage your account information and view your activity
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Information */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Profile Information
                  </h2>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-6">
                    {/* Avatar Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Avatar
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                          {editForm.avatar ? (
                            <span className="text-2xl">{editForm.avatar}</span>
                          ) : (
                            <Icons.User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {[
                  { emoji: '👤', icon: <Icons.User className="w-6 h-6" /> },
                  { emoji: '😊', icon: <Icons.Smile className="w-6 h-6" /> },
                  { emoji: '🚀', icon: <Icons.Rocket className="w-6 h-6" /> },
                  { emoji: '💻', icon: <Icons.Laptop className="w-6 h-6" /> },
                  { emoji: '🎯', icon: <Icons.Target className="w-6 h-6" /> },
                  { emoji: '⭐', icon: <Icons.Star className="w-6 h-6" /> },
                  { emoji: '🔥', icon: <Icons.Flame className="w-6 h-6" /> },
                  { emoji: '💡', icon: <Icons.Lightbulb className="w-6 h-6" /> },
                  { emoji: '🏆', icon: <Icons.Trophy className="w-6 h-6" /> },
                  { emoji: '🎨', icon: <Icons.Palette className="w-6 h-6" /> }
                ].map((item) => (
                            <button
                              key={item.emoji}
                              type="button"
                              onClick={() => setEditForm(prev => ({ ...prev, avatar: item.emoji }))}
                              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                                editForm.avatar === item.emoji 
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {item.icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your full name"
                      />
                    </div>

                    {/* Email (non-editable) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Email cannot be changed. Contact support if you need to update it.
                      </p>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone Number <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={updating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {updating ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Avatar Display */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                        {user?.avatar ? (
                          <span className="text-2xl">{user.avatar}</span>
                        ) : (
                          <Icons.User className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {user?.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Member since {getJoinDate()}
                        </p>
                      </div>
                    </div>

                    {/* Profile Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Full Name
                        </label>
                        <p className="text-gray-900 dark:text-white">{user?.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email Address
                        </label>
                        <p className="text-gray-900 dark:text-white">{user?.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Phone Number
                        </label>
                        <p className="text-gray-900 dark:text-white">
                          {user?.phone || <span className="text-gray-400 italic">Not provided</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Organizations Section */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Organizations
                </h2>
                
                {organizations.length === 0 ? (
                  <div className="text-center py-8">
                    <Icons.Building2 className="w-16 h-16 text-gray-400 mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      You're not part of any organizations yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {organizations.map((org) => (
                      <div key={org._id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="text-2xl">
                              {org.logo === '🏢' ? <Icons.Building2 className="w-6 h-6" /> : org.logo}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {org.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(org.userRole || 'member')}`}>
                                  {org.userRole?.charAt(0).toUpperCase()}{org.userRole?.slice(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {org.userRole !== 'owner' && (
                            <button
                              onClick={() => handleLeaveOrganization(org._id)}
                              disabled={leavingOrgId === org._id}
                              className="ml-3 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Leave Organization"
                            >
                              {leavingOrgId === org._id ? 'Leaving...' : 'Leave'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border-l-4 border-red-400">
                <h2 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                  Danger Zone
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Delete Account
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-sm font-medium"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onAccountDeleted={handleAccountDeleted}
      />
    </>
  );
}
