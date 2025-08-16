import { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
  recipient: Schema.Types.ObjectId;
  sender: Schema.Types.ObjectId;
  type: 'task_assigned' | 'task_updated' | 'mentioned' | 'comment_added' | 'org_member_added' | 'org_role_updated' | 'project_member_added';
  title: string;
  message: string;
  relatedTask?: Schema.Types.ObjectId;
  relatedComment?: Schema.Types.ObjectId;
  relatedOrganization?: Schema.Types.ObjectId;
  relatedProject?: Schema.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['task_assigned', 'task_updated', 'mentioned', 'comment_added', 'org_member_added', 'org_role_updated', 'project_member_added'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedTask: {
    type: Schema.Types.ObjectId,
    ref: 'Task'
  },
  relatedComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  },
  relatedOrganization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  relatedProject: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export default model<INotification>('Notification', notificationSchema);
