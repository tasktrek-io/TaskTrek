import { Schema, model, Document } from 'mongoose';

export interface IReaction {
  emoji: string;
  users: Schema.Types.ObjectId[];
}

export interface IComment extends Document {
  task: Schema.Types.ObjectId;
  author: Schema.Types.ObjectId;
  content: string;
  reactions: IReaction[];
  createdAt: Date;
  updatedAt: Date;
}

const reactionSchema = new Schema<IReaction>({
  emoji: {
    type: String,
    required: true
  },
  users: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
});

const commentSchema = new Schema<IComment>({
  task: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  reactions: [reactionSchema]
}, {
  timestamps: true
});

export default model<IComment>('Comment', commentSchema); Schema, Document, Types } from 'mongoose';

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
