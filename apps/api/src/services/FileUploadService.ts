import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Request } from 'express';
import { logger } from '../utils/logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// File type validation
const allowedMimeTypes = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  videos: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/quicktime'],
};

const allAllowedTypes = [
  ...allowedMimeTypes.images,
  ...allowedMimeTypes.documents,
  ...allowedMimeTypes.videos,
];

// Determine file category
export const getFileCategory = (mimeType: string): 'image' | 'document' | 'video' | 'other' => {
  if (allowedMimeTypes.images.includes(mimeType)) return 'image';
  if (allowedMimeTypes.documents.includes(mimeType)) return 'document';
  if (allowedMimeTypes.videos.includes(mimeType)) return 'video';
  return 'other';
};

// File filter function
const fileFilter = (req: Request, file: any, cb: multer.FileFilterCallback) => {
  logger.debug('File upload validation', {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  });

  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type ${file.mimetype} is not allowed. Allowed types: images, PDFs, videos, office documents`
      )
    );
  }
};

// Multer configuration for memory storage
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Maximum 10 files per request
  },
  fileFilter,
});

// Upload to Cloudinary
export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  filename: string;
}

export const uploadToCloudinary = async (
  file: any,
  folder: string = 'task-documents'
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder,
      resource_type: 'auto', // Auto-detect file type
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    // For non-image files, use raw resource type for better handling
    if (!allowedMimeTypes.images.includes(file.mimetype)) {
      uploadOptions.resource_type = 'raw';
    }

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        logger.error(
          'Cloudinary upload failed',
          {
            filename: file.originalname,
            mimeType: file.mimetype,
            error: error.message,
          },
          error
        );
        reject(error);
      } else if (result) {
        logger.info('File uploaded to Cloudinary', {
          filename: file.originalname,
          publicId: result.public_id,
          url: result.secure_url,
        });

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          filename: result.public_id.split('/').pop() || file.originalname,
        });
      } else {
        reject(new Error('Upload failed - no result returned'));
      }
    });

    uploadStream.end(file.buffer);
  });
};

// Delete from Cloudinary
export const deleteFromCloudinary = async (publicId: string, category?: string): Promise<void> => {
  try {
    // Determine resource type based on category
    let resourceTypes: string[];

    if (category) {
      switch (category) {
        case 'image':
          resourceTypes = ['image'];
          break;
        case 'video':
          resourceTypes = ['video'];
          break;
        case 'document':
        case 'other':
        default:
          resourceTypes = ['raw'];
          break;
      }
    } else {
      // Fallback: try all types if category is unknown
      resourceTypes = ['image', 'video', 'raw'];
    }

    let deleted = false;
    let lastError = null;

    for (const resourceType of resourceTypes) {
      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });

        if (result.result === 'ok') {
          deleted = true;
          logger.info('File deleted from Cloudinary', {
            publicId,
            resourceType,
            category,
            result: result.result,
          });
          break;
        }
      } catch (error) {
        lastError = error;
        // Continue to next resource type
      }
    }

    if (!deleted) {
      logger.error('Failed to delete file from Cloudinary with any resource type', {
        publicId,
        category,
        triedResourceTypes: resourceTypes,
      });
      throw lastError || new Error('Failed to delete file from Cloudinary');
    }
  } catch (error) {
    logger.error('Failed to delete file from Cloudinary', { publicId, category }, error as Error);
    throw error;
  }
};

// Validate Cloudinary configuration
export const validateCloudinaryConfig = (): boolean => {
  const requiredVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    logger.error('Missing Cloudinary configuration', { missingVars: missing });
    return false;
  }

  logger.info('Cloudinary configuration validated');
  return true;
};

export default {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
  getFileCategory,
  validateCloudinaryConfig,
};
