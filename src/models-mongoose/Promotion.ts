import mongoose, { Schema, Document } from 'mongoose';

export interface PromotionDocument extends Document {
  company: mongoose.Types.ObjectId;
  code: string;
  description: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  minPurchaseAmount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  targetBranches?: mongoose.Types.ObjectId[];
  targetCategories?: mongoose.Types.ObjectId[];
}

const promotionSchema = new Schema<PromotionDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['percentage', 'fixed_amount'], required: true },
    value: { type: Number, required: true },
    minPurchaseAmount: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageLimit: { type: Number },
    usageCount: { type: Number, default: 0 },
    targetBranches: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    targetCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
  },
  { timestamps: true },
);

// Garantizar índice único para el código dentro de la misma compañía
promotionSchema.index({ company: 1, code: 1 }, { unique: true });

export default mongoose.model<PromotionDocument>('Promotion', promotionSchema);
