import { Router, Request, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { upload, validateCloudinaryConfig } from '../services/FileUploadService';
import DocumentService from '../services/DocumentService';
import { logger } from '../utils/logger';

const router = Router();

// Validate Cloudinary configuration on startup
if (!validateCloudinaryConfig()) {
  logger.error('Cloudinary configuration is missing. Document upload will not work.');
}

// Upload documents to a task
router.post('/tasks/:taskId/documents', requireAuth, upload.array('documents', 10), async (req: AuthedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { description } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    logger.info('Document upload request', {
      taskId,
      fileCount: files.length,
      userId: req.user!.id,
      filenames: files.map(f => f.originalname)
    });

    const documents = await DocumentService.uploadDocuments(files, {
      taskId,
      uploadedBy: req.user!.id,
      description
    });

    res.status(201).json({
      message: `Successfully uploaded ${documents.length} document(s)`,
      documents: documents.map(doc => ({
        id: doc._id,
        filename: doc.filename,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        url: doc.url,
        category: doc.category,
        description: doc.description,
        uploadedAt: doc.uploadedAt
      }))
    });

  } catch (error) {
    logger.error('Document upload failed', {
      taskId: req.params.taskId,
      userId: req.user?.id
    }, error as Error);

    if (error instanceof Error) {
      if (error.message.includes('File type') || error.message.includes('not allowed')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Task not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('File too large')) {
        return res.status(413).json({ error: 'File size exceeds 10MB limit' });
      }
    }

    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Get documents for a task
router.get('/tasks/:taskId/documents', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const documents = await DocumentService.getTaskDocuments(taskId);

    res.json({
      documents: documents.map(doc => ({
        id: doc._id,
        filename: doc.filename,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        url: doc.url,
        category: doc.category,
        description: doc.description,
        uploadedAt: doc.uploadedAt,
        uploadedBy: doc.uploadedByUser ? {
          id: doc.uploadedByUser._id,
          name: doc.uploadedByUser.name,
          email: doc.uploadedByUser.email
        } : null
      }))
    });

  } catch (error) {
    logger.error('Failed to get task documents', {
      taskId: req.params.taskId,
      userId: req.user?.id
    }, error as Error);

    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// Get a specific document
router.get('/documents/:documentId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await DocumentService.getDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      document: {
        id: document._id,
        filename: document.filename,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        url: document.url,
        category: document.category,
        description: document.description,
        uploadedAt: document.uploadedAt,
        uploadedBy: document.uploadedByUser ? {
          id: document.uploadedByUser._id,
          name: document.uploadedByUser.name,
          email: document.uploadedByUser.email
        } : null
      }
    });

  } catch (error) {
    logger.error('Failed to get document', {
      documentId: req.params.documentId,
      userId: req.user?.id
    }, error as Error);

    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

// Update document (description only)
router.patch('/documents/:documentId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { documentId } = req.params;
    const { description } = req.body;

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ error: 'Description cannot exceed 500 characters' });
    }

    const updatedDocument = await DocumentService.updateDocument(
      documentId,
      { description },
      req.user!.id
    );

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      message: 'Document updated successfully',
      document: {
        id: updatedDocument._id,
        description: updatedDocument.description
      }
    });

  } catch (error) {
    logger.error('Failed to update document', {
      documentId: req.params.documentId,
      userId: req.user?.id
    }, error as Error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete a document
router.delete('/documents/:documentId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    await DocumentService.deleteDocument(documentId, req.user!.id);

    res.json({ message: 'Document deleted successfully' });

  } catch (error) {
    logger.error('Failed to delete document', {
      documentId: req.params.documentId,
      userId: req.user?.id
    }, error as Error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Get user's documents
router.get('/user/documents', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    if (limit > 100) {
      return res.status(400).json({ error: 'Limit cannot exceed 100' });
    }

    const documents = await DocumentService.getUserDocuments(req.user!.id, limit);

    res.json({
      documents: documents.map(doc => ({
        id: doc._id,
        filename: doc.filename,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        url: doc.url,
        category: doc.category,
        description: doc.description,
        uploadedAt: doc.uploadedAt,
        task: (doc as any).taskId ? {
          id: (doc as any).taskId._id,
          title: (doc as any).taskId.title
        } : null
      }))
    });

  } catch (error) {
    logger.error('Failed to get user documents', {
      userId: req.user?.id
    }, error as Error);

    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// Get document statistics for a task
router.get('/tasks/:taskId/documents/stats', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const stats = await DocumentService.getTaskDocumentStats(taskId);

    res.json({ stats });

  } catch (error) {
    logger.error('Failed to get document stats', {
      taskId: req.params.taskId,
      userId: req.user?.id
    }, error as Error);

    res.status(500).json({ error: 'Failed to retrieve document statistics' });
  }
});

export default router;
