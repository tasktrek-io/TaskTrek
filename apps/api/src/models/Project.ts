import mongoose, { Schema, Document, Types } from 'mongoose';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface IProject extends Document {
  workspace: Types.ObjectId; // Workspace
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  tags: string[];
  owner: Types.ObjectId; // User
  members: Types.ObjectId[]; // Users
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
    },
    startDate: { type: Date },
    endDate: { type: Date },
    tags: [{ type: String }],
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

const Project = mongoose.model<IProject>('Project', ProjectSchema);
export default Project;
