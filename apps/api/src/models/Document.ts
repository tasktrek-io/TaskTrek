import mongoose, { Document as MongoDocument, Schema } from 'mongoose';

export interface IDocument extends MongoDocument {
  taskId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  publicId: string; // Cloudinary public ID for deletion
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  description?: string;
  category: 'image' | 'document' | 'video' | 'other';
}

const DocumentSchema = new Schema<IDocument>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      max: 10 * 1024 * 1024, // 10MB limit
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: ['image', 'document', 'video', 'other'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
DocumentSchema.index({ taskId: 1, uploadedAt: -1 });
DocumentSchema.index({ uploadedBy: 1 });

const Document = mongoose.model<IDocument>('Document', DocumentSchema);

export default Document;
