import mongoose, { Schema, Document, Types } from 'mongoose';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface ITask extends Document {
  project: Types.ObjectId; // Project
  title: string;
  description?: string;
  assignee?: Types.ObjectId; // User
  status: TaskStatus;
  createdBy: Types.ObjectId; // User
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  description: { type: String },
  assignee: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const Task = mongoose.model<ITask>('Task', TaskSchema);
export default Task;
