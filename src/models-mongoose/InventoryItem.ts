import mongoose, { Schema, Document } from 'mongoose';

export interface InventoryItemDocument extends Document {
  name: string;
  company: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  supplier: mongoose.Types.ObjectId;
  stock: number;
  costPrice: number;
  sellingPrice?: number;
  measurement: 'unit' | 'g' | 'ml' | 'kg' | 'l';
  product?: mongoose.Types.ObjectId; // Si está vinculado a un producto de venta
  rawMaterial?: mongoose.Types.ObjectId; // Si está vinculado a un insumo maestro
  barCode?: string;
  receivedDate: Date;
  expirationDate?: Date;
  modifications?: {
    name: string;
    extraPrice: number;
    isExclusive?: boolean;
  }[];
}

const inventoryItemSchema = new Schema<InventoryItemDocument>({
  name: { type: String, required: true },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: false },
  stock: { type: Number, required: true, default: 0, min: 0 },
  costPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, min: 0 },
  measurement: { 
    type: String, 
    enum: ['unit', 'g', 'ml', 'kg', 'l'], 
    default: 'unit' 
  },
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  rawMaterial: { type: Schema.Types.ObjectId, ref: 'RawMaterial' },
  barCode: { type: String },
  receivedDate: { type: Date, default: Date.now },
  expirationDate: { type: Date },
  modifications: [
    {
      name: { type: String, required: true },
      extraPrice: { type: Number, required: true },
      isExclusive: { type: Boolean, default: false },
    },
  ],
});

export default mongoose.model<InventoryItemDocument>('InventoryItem', inventoryItemSchema);
