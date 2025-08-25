import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
  personalSpaceId?: string;
  lastActiveContext?: {
    type: 'personal' | 'organization';
    id: string;
  };
  // Password reset fields
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // Deletion fields
  deleted: boolean;
  deletedAt?: Date;
  originalEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, required: false },
    avatar: { type: String, required: false },
    emailVerified: { type: Boolean, default: false },
    personalSpaceId: {
      type: Schema.Types.ObjectId,
      ref: 'PersonalSpace',
    },
    lastActiveContext: {
      type: {
        type: String,
        enum: ['personal', 'organization'],
      },
      id: {
        type: Schema.Types.ObjectId,
      },
    },
    // Password reset fields
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // Deletion fields
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    originalEmail: { type: String }, // Store original email for potential reactivation
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>('User', UserSchema);
export default User;
