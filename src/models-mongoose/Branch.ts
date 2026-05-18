import mongoose, { Schema, Document } from 'mongoose';

export interface BranchDocument extends Document {
    company: mongoose.Types.ObjectId;
    name: string;
    address: string;
    tel: string;
    email: string;
    manager?: mongoose.Types.ObjectId; // Reference to an Admin user
    saleType?: 'retail' | 'hospitality'; // Can override company default
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
