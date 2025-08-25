'use client';

import { useState } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrganizationCreated: (organization: any) => void;
}

export default function CreateOrganizationModal({
  isOpen,
  onClose,
  onOrganizationCreated,
}: CreateOrganizationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Organization name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/contexts/organizations', {
        name: formData.name.trim(),
        description: formData.description.trim(),
      });

      onOrganizationCreated(response.data);

      // Reset form
      setFormData({ name: '', description: '' });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({ name: '', description: '' });
      setError('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title='Create New Organization' size='md'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && (
          <div className='p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg'>
            <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
          </div>
        )}

        <div>
          <label
            htmlFor='org-name'
            className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
          >
            Organization Name *
          </label>
          <input
            id='org-name'
            type='text'
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            placeholder='Enter organization name'
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor='org-description'
            className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
          >
            Description
          </label>
          <textarea
            id='org-description'
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            placeholder='Optional description for your organization'
            rows={3}
            disabled={isLoading}
          />
        </div>

        <div className='flex gap-3 pt-4'>
          <button
            type='button'
            onClick={handleClose}
            className='flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50'
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type='submit'
            className='flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            disabled={isLoading || !formData.name.trim()}
          >
            {isLoading ? (
              <div className='flex items-center justify-center'>
                <svg
                  className='animate-spin -ml-1 mr-2 h-4 w-4 text-white'
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
                Creating...
              </div>
            ) : (
              'Create Organization'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
