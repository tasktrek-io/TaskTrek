import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComment extends Document {
  task: Types.ObjectId; // Task
  author: Types.ObjectId; // User
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>({
  task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const Comment = mongoose.model<IComment>('Comment', CommentSchema);
export default Comment;
