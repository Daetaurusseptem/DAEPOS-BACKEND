import mongoose, { Schema, Document } from 'mongoose';

export interface ManualPaymentDocument extends Document {
  company: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  planRequested?: mongoose.Types.ObjectId;
  amount: number;
  proofImageUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  reminderDate?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
}

const manualPaymentSchema = new Schema<ManualPaymentDocument>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  planRequested: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  amount: { type: Number, required: true },
  proofImageUrl: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNotes: { type: String },
  reminderDate: { type: Date },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ManualPaymentDocument>('ManualPayment', manualPaymentSchema);
