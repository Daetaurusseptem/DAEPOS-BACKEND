import mongoose, { Schema, Document } from 'mongoose';

export interface BranchDocument extends Document {
  company: mongoose.Types.ObjectId;
  name: string;
  address: string;
  tel: string;
  email: string;
  manager?: mongoose.Types.ObjectId; // Reference to an Admin user
  saleType?: 'retail' | 'hospitality'; // Can override company default
  loyaltySettings?: {
    enabled: boolean;
    identifierType: 'phone' | 'physical_card' | 'both';
    pointsEarnRate: number;
    pointsRedeemRate: number;
    maxRedemptionPercentage: number;
  };
  kitchenSettings?: {
    enableKitchenModule: boolean;
    bypassKitchenDoubleCheck: boolean;
  };
  createdAt: Date;
  isActive: boolean;
  enableVirtualKeyboard: boolean;
  shiftSettings?: {
    maxShiftDurationHours: number;
  };
  posSettings?: {
    blindClosure: boolean;
    requirePinForRisks: boolean;
  };
}

const branchSchema = new Schema<BranchDocument>({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  tel: String,
  email: String,
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  saleType: {
    type: String,
    enum: ['retail', 'hospitality'],
  },
  loyaltySettings: {
    enabled: { type: Boolean, default: true },
    identifierType: { type: String, enum: ['phone', 'physical_card', 'both'], default: 'phone' },
    pointsEarnRate: { type: Number, default: 10 },
    pointsRedeemRate: { type: Number, default: 0.1 },
    maxRedemptionPercentage: { type: Number, default: 100 },
  },
  kitchenSettings: {
    enableKitchenModule: { type: Boolean, default: false },
    bypassKitchenDoubleCheck: { type: Boolean, default: true },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  enableVirtualKeyboard: {
    type: Boolean,
    default: false,
  },
  shiftSettings: {
    maxShiftDurationHours: { type: Number, default: 12 },
  },
  posSettings: {
    blindClosure: { type: Boolean, default: true },
    requirePinForRisks: { type: Boolean, default: true },
  },
});

const Branch = mongoose.model<BranchDocument>('Branch', branchSchema);

export default Branch;
