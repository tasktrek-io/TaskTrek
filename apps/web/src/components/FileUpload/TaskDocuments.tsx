'use client';

import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';
import FileUploadComponent from './FileUploadComponent';
import DocumentList from './DocumentList';

interface TaskDocumentsProps {
  taskId: string;
  taskTitle?: string;
  canEdit?: boolean;
  className?: string;
}

const TaskDocuments: React.FC<TaskDocumentsProps> = ({
  taskId,
  taskTitle,
  canEdit = true,
  className = '',
}) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUploadSuccess = (documents: any[]) => {
    setRefreshTrigger(prev => prev + 1);
    setUploadSuccess(`Successfully uploaded ${documents.length} document(s)`);
    setUploadError(null);

    // Clear success message after 5 seconds
    setTimeout(() => setUploadSuccess(null), 5000);
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
    setUploadSuccess(null);
  };

  const handleDocumentDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const dismissMessage = () => {
    setUploadSuccess(null);
    setUploadError(null);
  };

  return (
    <div className={`space-y-3 p-4 ${className}`}>
      {/* Compact Header */}
      <div className='flex items-center gap-2'>
        <Paperclip className='w-4 h-4 text-gray-500 dark:text-gray-400' />
        <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>Attachments</h3>
      </div>

      {/* Upload Section */}
      {canEdit && (
        <FileUploadComponent
          taskId={taskId}
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
        />
      )}

      {/* Documents List */}
      <DocumentList
        taskId={taskId}
        refreshTrigger={refreshTrigger}
        onDocumentDeleted={handleDocumentDeleted}
      />

      {/* Status Messages */}
      {uploadSuccess && (
        <div className='text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-md'>
          {uploadSuccess}
        </div>
      )}

      {uploadError && (
        <div className='text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md'>
          {uploadError}
        </div>
      )}
    </div>
  );
};

export default TaskDocuments;
