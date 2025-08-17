import Document, { IDocument } from '../models/Document';
import Task from '../models/Task';
import { uploadToCloudinary, deleteFromCloudinary, getFileCategory } from './FileUploadService';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export interface CreateDocumentData {
  taskId: string;
  uploadedBy: string;
  description?: string;
}

export interface DocumentWithMetadata extends IDocument {
  uploadedByUser?: {
    _id: string;
    name: string;
    email: string;
  };
}

export class DocumentService {
  /**
   * Upload multiple documents to a task
   */
  static async uploadDocuments(
    files: Express.Multer.File[],
    data: CreateDocumentData
  ): Promise<IDocument[]> {
    try {
      // Verify task exists and user has access
      const task = await Task.findById(data.taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      logger.info('Starting document upload', {
        taskId: data.taskId,
        fileCount: files.length,
        uploadedBy: data.uploadedBy
      });

      const uploadedDocuments: IDocument[] = [];

      // Process each file
      for (const file of files) {
        try {
          // Upload to Cloudinary
          const cloudinaryResult = await uploadToCloudinary(file, `tasks/${data.taskId}`);
          
          // Create document record
          const document = new Document({
            taskId: new Types.ObjectId(data.taskId),
            filename: cloudinaryResult.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: cloudinaryResult.url,
            publicId: cloudinaryResult.publicId,
            uploadedBy: new Types.ObjectId(data.uploadedBy),
            description: data.description,
            category: getFileCategory(file.mimetype)
          });

          await document.save();
          uploadedDocuments.push(document);

          // Add document reference to task
          await Task.findByIdAndUpdate(
            data.taskId,
            { $push: { documents: document._id } }
          );

          logger.info('Document uploaded successfully', {
            documentId: document._id,
            filename: file.originalname,
            taskId: data.taskId
          });

        } catch (error) {
          logger.error('Failed to upload individual file', {
            filename: file.originalname,
            taskId: data.taskId
          }, error as Error);
          
          // Continue with other files even if one fails
          continue;
        }
      }

      if (uploadedDocuments.length === 0) {
        throw new Error('Failed to upload any documents');
      }

      logger.info('Document upload batch completed', {
        taskId: data.taskId,
        successCount: uploadedDocuments.length,
        totalCount: files.length
      });

      return uploadedDocuments;

    } catch (error) {
      logger.error('Document upload batch failed', {
        taskId: data.taskId,
        fileCount: files.length
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get all documents for a task
   */
  static async getTaskDocuments(taskId: string): Promise<DocumentWithMetadata[]> {
    try {
      const documents = await Document.find({ taskId })
        .populate('uploadedBy', 'name email')
        .sort({ uploadedAt: -1 })
        .lean();

      logger.debug('Retrieved task documents', {
        taskId,
        documentCount: documents.length
      });

      return documents as DocumentWithMetadata[];
    } catch (error) {
      logger.error('Failed to get task documents', { taskId }, error as Error);
      throw error;
    }
  }

  /**
   * Get a single document by ID
   */
  static async getDocument(documentId: string): Promise<DocumentWithMetadata | null> {
    try {
      const document = await Document.findById(documentId)
        .populate('uploadedBy', 'name email')
        .lean();

      logger.debug('Retrieved document', { documentId, found: !!document });

      return document as DocumentWithMetadata;
    } catch (error) {
      logger.error('Failed to get document', { documentId }, error as Error);
      throw error;
    }
  }

  /**
   * Update document description
   */
  static async updateDocument(
    documentId: string,
    updates: { description?: string },
    userId: string
  ): Promise<IDocument | null> {
    try {
      const document = await Document.findById(documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Check if user is the uploader or has task access
      if (document.uploadedBy.toString() !== userId) {
        // Could add additional permission checks here
        const task = await Task.findById(document.taskId);
        if (!task) {
          throw new Error('Associated task not found');
        }
        
        // Add permission logic here if needed
      }

      const updatedDocument = await Document.findByIdAndUpdate(
        documentId,
        updates,
        { new: true, runValidators: true }
      );

      logger.info('Document updated', {
        documentId,
        updatedBy: userId,
        updates: Object.keys(updates)
      });

      return updatedDocument;
    } catch (error) {
      logger.error('Failed to update document', { documentId, userId }, error as Error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      const document = await Document.findById(documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Check permissions (document uploader or task access)
      if (document.uploadedBy.toString() !== userId) {
        const task = await Task.findById(document.taskId);
        if (!task) {
          throw new Error('Associated task not found');
        }
        // Add additional permission checks if needed
      }

      // Delete from Cloudinary
      await deleteFromCloudinary(document.publicId, document.category);

      // Remove from task's documents array
      await Task.findByIdAndUpdate(
        document.taskId,
        { $pull: { documents: document._id } }
      );

      // Delete document record
      await Document.findByIdAndDelete(documentId);

      logger.info('Document deleted successfully', {
        documentId,
        filename: document.originalName,
        deletedBy: userId
      });

    } catch (error) {
      logger.error('Failed to delete document', { documentId, userId }, error as Error);
      throw error;
    }
  }

  /**
   * Get documents by user
   */
  static async getUserDocuments(userId: string, limit: number = 50): Promise<DocumentWithMetadata[]> {
    try {
      const documents = await Document.find({ uploadedBy: userId })
        .populate('uploadedBy', 'name email')
        .populate('taskId', 'title')
        .sort({ uploadedAt: -1 })
        .limit(limit)
        .lean();

      logger.debug('Retrieved user documents', {
        userId,
        documentCount: documents.length
      });

      return documents as DocumentWithMetadata[];
    } catch (error) {
      logger.error('Failed to get user documents', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Get document statistics for a task
   */
  static async getTaskDocumentStats(taskId: string) {
    try {
      const stats = await Document.aggregate([
        { $match: { taskId: new Types.ObjectId(taskId) } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }
        }
      ]);

      const totalDocuments = await Document.countDocuments({ taskId });
      const totalSize = await Document.aggregate([
        { $match: { taskId: new Types.ObjectId(taskId) } },
        { $group: { _id: null, totalSize: { $sum: '$size' } } }
      ]);

      return {
        totalDocuments,
        totalSize: totalSize[0]?.totalSize || 0,
        byCategory: stats
      };
    } catch (error) {
      logger.error('Failed to get document stats', { taskId }, error as Error);
      throw error;
    }
  }
}

export default DocumentService;
