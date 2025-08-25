import mongoose, { Schema, Document, Types } from 'mongoose';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ITask extends Document {
  project: Types.ObjectId; // Project
  title: string;
  description?: string;
  assignees: Types.ObjectId[]; // Users
  watchers: Types.ObjectId[]; // Users
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  createdBy: Types.ObjectId; // User
  documents: Types.ObjectId[]; // Document references
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    description: { type: String },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    watchers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    dueDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    documents: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
  },
  { timestamps: true }
);

const Task = mongoose.model<ITask>('Task', TaskSchema);
export default Task;
