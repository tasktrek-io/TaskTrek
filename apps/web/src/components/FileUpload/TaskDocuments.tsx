'use client';

import React, { useState } from 'react';
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
  className = ''
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
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      {taskTitle && (
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-xl font-semibold text-gray-900">{taskTitle}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage documents and files for this task
          </p>
        </div>
      )}

      {/* Success/Error Messages */}
      {(uploadSuccess || uploadError) && (
        <div
          className={`
            p-4 rounded-md flex items-center justify-between
            ${uploadSuccess 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
            }
          `}
        >
          <p className="text-sm font-medium">
            {uploadSuccess || uploadError}
          </p>
          <button
            onClick={dismissMessage}
            className="ml-4 text-current hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Section */}
      {canEdit && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Upload Documents
          </h3>
          <FileUploadComponent
            taskId={taskId}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <DocumentList
          taskId={taskId}
          refreshTrigger={refreshTrigger}
          onDocumentDeleted={handleDocumentDeleted}
        />
      </div>
    </div>
  );
};

export default TaskDocuments;
