import mongoose, { Schema, Document } from 'mongoose';

export interface CustomerDocument extends Document {
  company: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  cardNumber?: string;
  rfc?: string;
  loyaltyPoints: number;
  tier: 'bronze' | 'silver' | 'gold';
  totalSpent: number;
  salesCount: number;
  isActive: boolean;
  createdAt: Date;
}

const customerSchema = new Schema<CustomerDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String, index: true },
    cardNumber: { type: String, index: true },
    rfc: { type: String },
    loyaltyPoints: { type: Number, default: 0 },
    tier: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' },
    totalSpent: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<CustomerDocument>('Customer', customerSchema);
