'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Icons } from '../lib/icons';

interface Organization {
  _id: string;
  name: string;
  members: Array<{
    userId: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
  }>;
}

interface User {
  _id: string;
  name: string;
  email: string;
}

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountDeleted: () => void;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onAccountDeleted,
}: DeleteAccountModalProps) {
  const [step, setStep] = useState<'warning' | 'transfer' | 'confirm'>('warning');
  const [ownedOrganizations, setOwnedOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transferData, setTransferData] = useState<Record<string, string>>({});
  const [organizationMembers, setOrganizationMembers] = useState<Record<string, User[]>>({});
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadOwnedOrganizations();
      setStep('warning');
      setError('');
      setConfirmText('');
    }
  }, [isOpen]);

  const loadOwnedOrganizations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/owned-organizations');
      setOwnedOrganizations(response.data.organizations);

      if (response.data.organizations.length > 0) {
        // Load members for each organization
        const membersData: Record<string, User[]> = {};
        for (const org of response.data.organizations) {
          try {
            const membersResponse = await api.get(`/contexts/organizations/${org._id}/members`);
            membersData[org._id] = membersResponse.data.members.map((member: any) => ({
              _id: member._id || member.userId,
              name: member.name,
              email: member.email,
            }));
          } catch (err) {
            console.error(`Failed to load members for org ${org._id}:`, err);
            membersData[org._id] = [];
          }
        }
        setOrganizationMembers(membersData);
      }
    } catch (err: any) {
      console.error('Error loading owned organizations:', err);
      setError(err.response?.data?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (ownedOrganizations.length === 0) {
      setStep('confirm');
    } else {
      setStep('transfer');
    }
  };

  const handleTransferOwnership = async (orgId: string, newOwnerId: string) => {
    try {
      await api.post('/auth/transfer-ownership', {
        organizationId: orgId,
        newOwnerId: newOwnerId,
      });

      // Remove this organization from the owned list
      setOwnedOrganizations(prev => prev.filter(org => org._id !== orgId));

      // Clear transfer data for this org
      setTransferData(prev => {
        const newData = { ...prev };
        delete newData[orgId];
        return newData;
      });
    } catch (err: any) {
      console.error('Error transferring ownership:', err);
      setError(err.response?.data?.message || 'Failed to transfer ownership');
    }
  };

  const handleTransferAll = async () => {
    try {
      setLoading(true);
      setError('');

      // Transfer ownership for all organizations
      for (const org of ownedOrganizations) {
        const newOwnerId = transferData[org._id];
        if (!newOwnerId) {
          setError(`Please select a new owner for ${org.name}`);
          return;
        }
        await handleTransferOwnership(org._id, newOwnerId);
      }

      // After all transfers are complete, reload to verify no organizations remain
      await loadOwnedOrganizations();

      // If no organizations remain after transfer, move to confirm step
      if (ownedOrganizations.length === 0) {
        setStep('confirm');
      }
    } catch (err: any) {
      console.error('Error during ownership transfer:', err);
      setError(err.response?.data?.message || 'Failed to transfer ownership');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    try {
      setDeleting(true);
      setError('');

      await api.delete('/auth/delete-account');
      onAccountDeleted();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
        <div className='p-6 border-b border-gray-200 dark:border-gray-600'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center'>
                <svg
                  className='w-4 h-4 text-red-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
                Delete Account
              </h2>
            </div>
            <button
              onClick={onClose}
              className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            >
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        </div>

        <div className='p-6'>
          {error && (
            <div className='mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4'>
              <div className='flex'>
                <div className='flex-shrink-0'>
                  <svg
                    className='h-5 w-5 text-red-400'
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 20 20'
                    fill='currentColor'
                  >
                    <path
                      fillRule='evenodd'
                      d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
                <div className='ml-3'>
                  <p className='text-sm text-red-700 dark:text-red-300'>{error}</p>
                </div>
              </div>
            </div>
          )}

          {step === 'warning' && (
            <div className='space-y-4'>
              <div className='bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <svg
                      className='h-5 w-5 text-red-400'
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 20 20'
                      fill='currentColor'
                    >
                      <path
                        fillRule='evenodd'
                        d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <div className='ml-3'>
                    <h3 className='text-sm font-medium text-red-800 dark:text-red-300'>
                      Warning: This action cannot be undone
                    </h3>
                    <div className='mt-2 text-sm text-red-700 dark:text-red-400'>
                      <p>Deleting your account will permanently:</p>
                      <ul className='list-disc list-inside mt-2 space-y-1'>
                        <li>Delete all your personal data and workspaces</li>
                        <li>Remove you from all organizations</li>
                        <li>Delete all your tasks and projects</li>
                        <li>Clear all your notifications</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className='flex justify-center'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-red-600'></div>
                </div>
              ) : (
                <>
                  {ownedOrganizations.length > 0 && (
                    <div className='bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4'>
                      <div className='flex'>
                        <div className='flex-shrink-0'>
                          <svg
                            className='h-5 w-5 text-yellow-400'
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 20 20'
                            fill='currentColor'
                          >
                            <path
                              fillRule='evenodd'
                              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                              clipRule='evenodd'
                            />
                          </svg>
                        </div>
                        <div className='ml-3'>
                          <h3 className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                            Transfer Required
                          </h3>
                          <div className='mt-2 text-sm text-yellow-700 dark:text-yellow-400'>
                            <p>
                              You own {ownedOrganizations.length} organization(s). You must transfer
                              ownership before deleting your account:
                            </p>
                            <ul className='list-disc list-inside mt-2'>
                              {ownedOrganizations.map(org => (
                                <li key={org._id}>{org.name}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className='flex gap-3 justify-end'>
                    <button
                      onClick={onClose}
                      className='px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700'
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContinue}
                      className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'transfer' && (
            <div className='space-y-6'>
              <div>
                <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
                  Transfer Organization Ownership
                </h3>
                <p className='text-sm text-gray-600 dark:text-gray-400 mb-6'>
                  Select a new owner for each organization. The new owner must be an existing
                  member.
                </p>
              </div>

              <div className='space-y-4'>
                {ownedOrganizations.map(org => (
                  <div
                    key={org._id}
                    className='border border-gray-200 dark:border-gray-600 rounded-lg p-4'
                  >
                    <h4 className='font-medium text-gray-900 dark:text-white mb-3'>{org.name}</h4>

                    {organizationMembers[org._id]?.length === 0 ? (
                      <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md p-3'>
                        <p className='text-sm text-yellow-800 dark:text-yellow-300'>
                          This organization has no other members. You need to add members before you
                          can transfer ownership.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                          New Owner
                        </label>
                        <select
                          value={transferData[org._id] || ''}
                          onChange={e =>
                            setTransferData(prev => ({ ...prev, [org._id]: e.target.value }))
                          }
                          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                          <option value=''>Select new owner...</option>
                          {organizationMembers[org._id]?.map(member => (
                            <option key={member._id} value={member._id}>
                              {member.name} ({member.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {ownedOrganizations.length === 0 && (
                <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md p-3'>
                  <p className='text-sm text-green-800 dark:text-green-300'>
                    <Icons.CheckCircle className='w-5 h-5 inline mr-2 text-green-600' /> All
                    organization ownership has been transferred successfully. You can now proceed
                    with account deletion.
                  </p>
                </div>
              )}

              <div className='flex gap-3 justify-end'>
                <button
                  onClick={() => setStep('warning')}
                  className='px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700'
                >
                  Back
                </button>
                {ownedOrganizations.length > 0 ? (
                  <button
                    onClick={handleTransferAll}
                    disabled={loading || ownedOrganizations.some(org => !transferData[org._id])}
                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {loading ? 'Transferring...' : 'Transfer Ownership'}
                  </button>
                ) : (
                  <button
                    onClick={() => setStep('confirm')}
                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                  >
                    Continue to Delete Account
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className='space-y-6'>
              <div>
                <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
                  Final Confirmation
                </h3>
                <p className='text-sm text-gray-600 dark:text-gray-400 mb-6'>
                  This is your last chance. Once you confirm, your account and all associated data
                  will be permanently deleted.
                </p>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Type <strong>DELETE</strong> to confirm:
                </label>
                <input
                  type='text'
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500'
                  placeholder='DELETE'
                />
              </div>

              <div className='flex gap-3 justify-end'>
                <button
                  onClick={onClose}
                  className='px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700'
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || confirmText !== 'DELETE'}
                  className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {deleting ? 'Deleting Account...' : 'Delete Account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
