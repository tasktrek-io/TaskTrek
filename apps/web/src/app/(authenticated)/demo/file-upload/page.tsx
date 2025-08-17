'use client';

import React, { useState } from 'react';
import TaskDocuments from '../../../../components/FileUpload/TaskDocuments';

export default function FileUploadDemo() {
  const [taskId, setTaskId] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskId.trim()) {
      setShowDemo(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            File Upload Demo
          </h1>
          <p className="text-gray-600 mb-6">
            Enter a task ID to test the file upload functionality.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="Enter Task ID (e.g., 673b2f2f1234567890abcdef)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Load Demo
            </button>
          </form>
        </div>

        {showDemo && (
          <TaskDocuments
            taskId={taskId}
            taskTitle={`Task Documents (ID: ${taskId})`}
            canEdit={true}
          />
        )}

        {/* Usage Instructions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            How to Use
          </h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-900">Upload Files:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Drag and drop files into the upload area</li>
                <li>Or click to browse and select files</li>
                <li>Add an optional description</li>
                <li>Click upload to save files</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900">Supported File Types:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Images:</strong> JPEG, PNG, GIF, WebP, SVG</li>
                <li><strong>Documents:</strong> PDF, TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX</li>
                <li><strong>Videos:</strong> MP4, WebM, OGG, AVI, QuickTime</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">File Limits:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Maximum file size: 10MB per file</li>
                <li>Maximum files per upload: 10 files</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Manage Documents:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>View/preview images and PDFs</li>
                <li>Download any document</li>
                <li>Edit document descriptions</li>
                <li>Delete documents</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
