'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Image, Video, File, Download, Trash2, 
  Edit3, Save, X, Eye, Calendar, User 
} from 'lucide-react';
import { api } from '../../lib/api';

interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  category: 'image' | 'document' | 'video' | 'other';
  description?: string;
  uploadedAt: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface DocumentListProps {
  taskId: string;
  refreshTrigger?: number;
  onDocumentDeleted?: (documentId: string) => void;
  className?: string;
}

const DocumentList: React.FC<DocumentListProps> = ({
  taskId,
  refreshTrigger = 0,
  onDocumentDeleted,
  className = ''
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching documents for task:', taskId);
      const response = await api.get(`/tasks/${taskId}/documents`);
      console.log('Documents response:', response.data);
      setDocuments(response.data.documents);
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
      console.error('Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config
      });
      setError(err.response?.data?.error || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchDocuments();
    }
  }, [taskId, refreshTrigger]);

  const getFileIcon = (category: string, mimeType: string) => {
    switch (category) {
      case 'image':
        return Image;
      case 'video':
        return Video;
      case 'document':
        return FileText;
      default:
        return File;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = async (document: Document) => {
    try {
      // For images and other viewable files, open in new tab
      if (document.category === 'image') {
        window.open(document.url, '_blank');
        return;
      }

      // For other files, trigger download
      const response = await fetch(document.url);
      const blob = await response.blob();
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const linkElement = window.document.createElement('a');
      linkElement.href = downloadUrl;
      linkElement.download = document.originalName;
      window.document.body.appendChild(linkElement);
      linkElement.click();
      linkElement.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleView = (document: Document) => {
    window.open(document.url, '_blank');
  };

  const startEditing = (document: Document) => {
    setEditingDoc(document.id);
    setEditDescription(document.description || '');
  };

  const cancelEditing = () => {
    setEditingDoc(null);
    setEditDescription('');
  };

  const saveDescription = async (documentId: string) => {
    try {
      await api.patch(`/documents/${documentId}`, {
        description: editDescription.trim()
      });

      // Update local state
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, description: editDescription.trim() }
          : doc
      ));

      setEditingDoc(null);
      setEditDescription('');
    } catch (error: any) {
      console.error('Failed to update description:', error);
      setError(error.response?.data?.error || 'Failed to update description');
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      setDeletingDoc(documentId);
      await api.delete(`/documents/${documentId}`);
      
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      onDocumentDeleted?.(documentId);
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      setError(error.response?.data?.error || 'Failed to delete document');
    } finally {
      setDeletingDoc(null);
    }
  };

  if (loading) {
    return (
      <div className={`flex justify-center items-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
          <p className="text-red-600 dark:text-red-300 font-medium mb-2">Failed to load documents</p>
          <p className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</p>
          {error.includes('Unauthorized') && (
            <p className="text-red-500 dark:text-red-400 text-xs mb-2">
              Authentication required. Please log in again.
            </p>
          )}
          {error.includes('Task not found') && (
            <p className="text-red-500 dark:text-red-400 text-xs mb-2">
              Task ID: {taskId}
            </p>
          )}
        </div>
        <button
          onClick={fetchDocuments}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <File className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p>No documents uploaded yet</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900">
        Documents ({documents.length})
      </h3>

      <div className="space-y-3">
        {documents.map((document) => {
          const FileIcon = getFileIcon(document.category, document.mimeType);
          const isEditing = editingDoc === document.id;
          const isDeleting = deletingDoc === document.id;

          return (
            <div
              key={document.id}
              className={`
                border rounded-lg p-4 transition-all
                ${isDeleting ? 'opacity-50' : 'hover:shadow-sm'}
              `}
            >
              <div className="flex items-start space-x-4">
                {/* File Icon/Preview */}
                <div className="flex-shrink-0">
                  {document.category === 'image' ? (
                    <img
                      src={document.url}
                      alt={document.originalName}
                      className="w-12 h-12 object-cover rounded-md cursor-pointer"
                      onClick={() => handleView(document)}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center">
                      <FileIcon className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                </div>

                {/* File Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {document.originalName}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatFileSize(document.size)} • {document.category}
                      </p>
                      
                      {/* Upload Info */}
                      <div className="flex items-center text-xs text-gray-400 mt-1 space-x-4">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(document.uploadedAt)}
                        </div>
                        {document.uploadedBy && (
                          <div className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {document.uploadedBy.name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {/* View/Download */}
                      {document.category === 'image' || document.mimeType === 'application/pdf' ? (
                        <button
                          onClick={() => handleView(document)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : null}
                      
                      <button
                        onClick={() => handleDownload(document)}
                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Edit Description */}
                      {!isEditing && (
                        <button
                          onClick={() => startEditing(document)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit description"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => deleteDocument(document.id)}
                        disabled={isDeleting}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mt-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Add a description..."
                          rows={2}
                          maxLength={500}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {editDescription.length}/500 characters
                          </span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveDescription(document.id)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              <Save className="w-3 h-3 inline mr-1" />
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                            >
                              <X className="w-3 h-3 inline mr-1" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      document.description && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 mt-2">
                          {document.description}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentList;
