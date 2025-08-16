import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  phone?: string;
  avatar?: string;
  personalSpaceId?: string;
  lastActiveContext?: {
    type: 'personal' | 'organization';
    id: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, required: false },
  avatar: { type: String, required: false },
  personalSpaceId: { 
    type: Schema.Types.ObjectId, 
    ref: 'PersonalSpace' 
  },
  lastActiveContext: {
    type: {
      type: String,
      enum: ['personal', 'organization']
    },
    id: {
      type: Schema.Types.ObjectId
    }
  }
}, {
  timestamps: true,
});

const User = mongoose.model<IUser>('User', UserSchema);
export default User;
