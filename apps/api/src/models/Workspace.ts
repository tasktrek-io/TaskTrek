import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWorkspace extends Document {
  name: string;
  description?: string;
  owner: Types.ObjectId; // User
  members: Types.ObjectId[]; // Users
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>({
  name: { type: String, required: true },
  description: { type: String },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  color: { type: String, default: '#ff6b35' }, // Default orange color
}, { timestamps: true });

const Workspace = mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
export default Workspace;
