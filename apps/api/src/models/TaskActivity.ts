import { Schema, model, Document } from 'mongoose';

export type ActivityAction = 
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'priority_changed'
  | 'due_date_changed'
  | 'title_changed'
  | 'description_changed'
  | 'comment_added'
  | 'comment_reaction_added'
  | 'comment_reaction_removed';

export interface ITaskActivity extends Document {
  taskId: Schema.Types.ObjectId;
  performedBy: Schema.Types.ObjectId;
  action: ActivityAction;
  field?: string;
  oldValue?: any;
  newValue?: any;
  details?: string;
  metadata?: any;
  timestamp: Date;
}

const taskActivitySchema = new Schema<ITaskActivity>({
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: [
      'created', 'updated', 'status_changed', 'assigned', 'unassigned', 
      'priority_changed', 'due_date_changed', 'title_changed', 'description_changed', 
      'comment_added', 'comment_reaction_added', 'comment_reaction_removed'
    ],
    required: true
  },
  field: {
    type: String
  },
  oldValue: {
    type: Schema.Types.Mixed
  },
  newValue: {
    type: Schema.Types.Mixed
  },
  details: {
    type: String
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for efficient queries
taskActivitySchema.index({ taskId: 1, createdAt: -1 });

export default model<ITaskActivity>('TaskActivity', taskActivitySchema);
