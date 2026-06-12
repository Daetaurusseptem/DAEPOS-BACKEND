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

import { getIO } from '../socket';

notificationSchema.post('save', function (doc) {
  try {
    const io = getIO();
    if (!io) return;

    // We send to the most specific room available
    let targetRoom = `company-${doc.company.toString()}`;
    if (doc.targetUser) {
      targetRoom = `user-${doc.targetUser.toString()}`;
    } else if (doc.targetRole) {
      targetRoom = `role-${doc.targetRole}-${doc.company.toString()}`;
    } else if (doc.targetBranch) {
      targetRoom = `branch-${doc.targetBranch.toString()}`;
    }

    // Prepare the payload (map to the format expected by frontend)
    const payload = {
      _id: doc._id,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      link: doc.link,
      createdAt: doc.createdAt,
      isRead: false // Newly created is always unread
    };

    io.to(targetRoom).emit('new-notification', payload);
  } catch (error) {
    console.error('Error emitting new-notification socket event:', error);
  }
});

export default mongoose.model<NotificationDocument>('Notification', notificationSchema);
