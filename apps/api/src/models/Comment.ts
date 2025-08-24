import { Schema, model, Document } from 'mongoose';

export interface IReaction {
  emoji: string;
  users: Schema.Types.ObjectId[];
  count: number;
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
    required: true,
  },
  users: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  count: {
    type: Number,
    default: 0,
  },
});

const commentSchema = new Schema<IComment>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    reactions: [reactionSchema],
  },
  {
    timestamps: true,
  }
);

export default model<IComment>('Comment', commentSchema);
