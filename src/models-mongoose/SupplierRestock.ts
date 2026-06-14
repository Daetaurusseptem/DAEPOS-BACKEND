import mongoose, { Schema, Document } from 'mongoose';

export interface RestockItem {
  type: 'Product' | 'RawMaterial'; // Modelos en mayúscula para refPath
  itemRef: mongoose.Types.ObjectId; // Referencia dinámica
  quantity: number;
  costPrice: number;
  agreedCost?: number;
  varianceNote?: string;
}

export interface SupplierRestockDocument extends Document {
  company: mongoose.Types.ObjectId;
  supplier?: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  expectedDate: Date;
  itemsSummary?: string;
  items: RestockItem[];
  status: 'pending' | 'completed' | 'cancelled' | 'pending_audit';
  requiresAudit?: boolean;
  notes?: string;
  isRecurring: boolean;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const restockItemSchema = new Schema<RestockItem>({
  type: { type: String, enum: ['Product', 'RawMaterial'], required: true },
  itemRef: { type: Schema.Types.ObjectId, refPath: 'items.type', required: true }, // [DINÁMICO]
  quantity: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, required: true, min: 0 },
  agreedCost: { type: Number },
  varianceNote: { type: String },
});

const supplierRestockSchema = new Schema<SupplierRestockDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: false },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    expectedDate: { type: Date, required: true },
    itemsSummary: { type: String },
    items: { type: [restockItemSchema], default: [] },
    status: { type: String, enum: ['pending', 'completed', 'cancelled', 'pending_audit'], default: 'pending' },
    requiresAudit: { type: Boolean, default: false },
    notes: { type: String },
    isRecurring: { type: Boolean, default: false },
    recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    recurrenceDays: { type: Number },
  },
  { timestamps: true },
);

export default mongoose.model<SupplierRestockDocument>('SupplierRestock', supplierRestockSchema);
