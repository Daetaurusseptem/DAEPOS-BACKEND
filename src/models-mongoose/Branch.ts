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
    createdAt: Date;
    isActive: boolean;
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
        pointsRedeemRate: { type: Number, default: 0.10 },
        maxRedemptionPercentage: { type: Number, default: 100 }
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
});

const Branch = mongoose.model<BranchDocument>('Branch', branchSchema);

export default Branch;
