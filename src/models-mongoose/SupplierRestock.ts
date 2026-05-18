import mongoose, { Schema, Document } from 'mongoose';

export interface SupplierRestockDocument extends Document {
  company: mongoose.Types.ObjectId;
  supplier: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  expectedDate: Date;
  itemsSummary: string; // Resumen de los artículos programados a reponer
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  isRecurring: boolean;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceDays?: number; // Para recurrencia personalizada
  createdAt: Date;
  updatedAt: Date;
}

const supplierRestockSchema = new Schema<SupplierRestockDocument>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  expectedDate: { type: Date, required: true },
  itemsSummary: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  notes: { type: String },
  isRecurring: { type: Boolean, default: false },
  recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  recurrenceDays: { type: Number }
}, { timestamps: true });

export default mongoose.model<SupplierRestockDocument>('SupplierRestock', supplierRestockSchema);
