'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, Image, Video, File } from 'lucide-react';
import { api } from '../../lib/api';

interface FileUploadProps {
  taskId: string;
  onUploadSuccess?: (documents: any[]) => void;
  onUploadError?: (error: string) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  className?: string;
}

interface UploadFile extends File {
  id: string;
  preview?: string;
}

interface UploadProgress {
  [fileId: string]: number;
}

const FileUploadComponent: React.FC<FileUploadProps> = ({
  taskId,
  onUploadSuccess,
  onUploadError,
  maxFiles = 10,
  maxFileSize = 10,
  className = ''
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File type validation based on backend service
  const allowedMimeTypes = {
    images: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/svg+xml'
    ],
    documents: [
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ],
    videos: [
      'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/quicktime'
    ]
  };

  const allAllowedTypes = [
    ...allowedMimeTypes.images,
    ...allowedMimeTypes.documents,
    ...allowedMimeTypes.videos
  ];

  const getFileIcon = (mimeType: string) => {
    if (allowedMimeTypes.images.includes(mimeType)) return Image;
    if (allowedMimeTypes.videos.includes(mimeType)) return Video;
    if (allowedMimeTypes.documents.includes(mimeType)) return FileText;
    return File;
  };

  const getFileCategory = (mimeType: string): string => {
    if (allowedMimeTypes.images.includes(mimeType)) return 'image';
    if (allowedMimeTypes.documents.includes(mimeType)) return 'document';
    if (allowedMimeTypes.videos.includes(mimeType)) return 'video';
    return 'other';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (!allAllowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed. Allowed types: images, PDFs, videos, office documents`;
    }
    
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }
    
    return null;
  };

  const createUploadFile = (file: File): UploadFile => {
    const uploadFile = file as UploadFile;
    uploadFile.id = Math.random().toString(36).substr(2, 9);
    
    // Create preview for images
    if (allowedMimeTypes.images.includes(file.type)) {
      uploadFile.preview = URL.createObjectURL(file);
    }
    
    return uploadFile;
  };

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadFile[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      if (files.length + newFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      newFiles.push(createUploadFile(file));
    });

    if (errors.length > 0) {
      onUploadError?.(errors.join('\n'));
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, [files.length, maxFiles, maxFileSize, onUploadError]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      const removedFile = prev.find(f => f.id === fileId);
      if (removedFile?.preview) {
        URL.revokeObjectURL(removedFile.preview);
      }
      return updated;
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress({});

    try {
      const formData = new FormData();
      
      files.forEach((file) => {
        formData.append('documents', file);
      });
      
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      console.log('Uploading files for task:', taskId);
      console.log('Files to upload:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));

      const response = await api.post(`/tasks/${taskId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            
            // Update progress for all files (simplified)
            const fileProgress: UploadProgress = {};
            files.forEach(file => {
              fileProgress[file.id] = progress;
            });
            setUploadProgress(fileProgress);
          }
        },
      });

      // Clean up file previews
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });

      // Reset form
      setFiles([]);
      setDescription('');
      setUploadProgress({});

      console.log('Upload successful:', response.data);
      onUploadSuccess?.(response.data.documents);

    } catch (error: any) {
      console.error('Upload failed:', error);
      console.error('Upload error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config
      });
      const errorMessage = error.response?.data?.error || 'Failed to upload files';
      onUploadError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-colors
          ${dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allAllowedTypes.join(',')}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <p className="text-lg font-medium text-gray-900">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Maximum {maxFiles} files, {maxFileSize}MB each
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports: Images, PDFs, Videos, Office Documents
            </p>
          </div>
        </div>
      </div>

      {/* Description Input */}
      {files.length > 0 && (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description for these files..."
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={uploading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {description.length}/500 characters
          </p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Selected Files ({files.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.type);
              const progress = uploadProgress[file.id] || 0;
              
              return (
                <div
                  key={file.id}
                  className="flex items-center p-3 bg-gray-50 rounded-lg border"
                >
                  {/* File Preview/Icon */}
                  <div className="flex-shrink-0 mr-3">
                    {file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <FileIcon className="w-10 h-10 text-gray-400" />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {getFileCategory(file.type)}
                    </p>
                    
                    {/* Progress Bar */}
                    {uploading && progress > 0 && (
                      <div className="mt-1">
                        <div className="bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {!uploading && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="flex-shrink-0 ml-3 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={uploadFiles}
            disabled={uploading || files.length === 0}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${uploading || files.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUploadComponent;
