import mongoose, { Schema, Document } from 'mongoose';

export interface NotificationDocument extends Document {
  company: mongoose.Types.ObjectId;
  targetBranch?: mongoose.Types.ObjectId;
  targetUser?: mongoose.Types.ObjectId;
  targetRole?: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  readBy: mongoose.Types.ObjectId[];
  link?: string;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  targetBranch: { type: Schema.Types.ObjectId, ref: 'Branch' },
  targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
  targetRole: { type: String },
  type: { type: String, enum: ['info', 'warning', 'error', 'success'], default: 'info' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  link: { type: String },
}, { timestamps: true });

export default mongoose.model<NotificationDocument>('Notification', notificationSchema);
