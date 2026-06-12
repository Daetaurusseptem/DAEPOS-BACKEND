import mongoose, { Schema, Document } from 'mongoose';

export interface SubscriptionPlanDocument extends Document {
    name: string;
    billingType: 'stripe' | 'manual';
    stripeProductId?: string;
    price: number;
    maxBranches: number;
    maxUsers: number;
    maxActiveRegisters: number;
    features: string[];
    isActive: boolean;
    isCustom: boolean;
    createdAt: Date;
}

const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>({
    name: { type: String, required: true },
    billingType: { type: String, enum: ['stripe', 'manual'], required: true, default: 'stripe' },
    stripeProductId: { type: String, unique: true, sparse: true },
    price: { type: Number, default: 0 },
    maxBranches: { type: Number, default: 1 },
    maxUsers: { type: Number, default: 3 },
    maxActiveRegisters: { type: Number, default: 1 },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isCustom: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const SubscriptionPlan = mongoose.model<SubscriptionPlanDocument>('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;
