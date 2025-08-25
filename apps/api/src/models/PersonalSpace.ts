import mongoose, { Schema, Document } from 'mongoose';

export interface IPersonalSpace extends Document {
  userId: string;
  settings: {
    theme: 'light' | 'dark';
    defaultView: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PersonalSpaceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    settings: {
      theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
      },
      defaultView: {
        type: String,
        default: 'list',
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IPersonalSpace>('PersonalSpace', PersonalSpaceSchema);
