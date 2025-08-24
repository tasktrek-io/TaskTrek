import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  logo?: string;
  ownerId: string;
  members: Array<{
    userId: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
  }>;
  settings: {
    defaultWorkspaceId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    logo: {
      type: String,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    settings: {
      defaultWorkspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workspace',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Ensure owner is always in members array
OrganizationSchema.pre('save', function (next) {
  if (this.isNew) {
    const ownerMember = this.members.find(
      member => member.userId.toString() === this.ownerId.toString()
    );

    if (!ownerMember) {
      this.members.push({
        userId: this.ownerId,
        role: 'owner',
        joinedAt: new Date(),
      });
    }
  }
  next();
});

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
