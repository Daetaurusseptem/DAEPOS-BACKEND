import mongoose, { Schema, Document } from 'mongoose';

export interface StockTransferDocument extends Document {
  company: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId; // Product ID
  fromBranch: mongoose.Types.ObjectId;
  toBranch: mongoose.Types.ObjectId;
  quantity: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdBy: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockTransferSchema = new Schema<StockTransferDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    fromBranch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    toBranch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'completed', // For now, let's make it direct completion
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model<StockTransferDocument>('StockTransfer', stockTransferSchema);
