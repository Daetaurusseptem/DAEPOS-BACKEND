import mongoose, { Schema, Document } from 'mongoose';

export interface RawMaterialDocument extends Document {
  name: string;
  description?: string;
  company: mongoose.Types.ObjectId;
  measurementUnit: 'g' | 'ml' | 'unit'; // Unidad de medida base de almacenamiento (mínimo común)
}

const rawMaterialSchema = new Schema<RawMaterialDocument>(
  {
    name: { type: String, required: true },
    description: { type: String },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    measurementUnit: {
      type: String,
      enum: ['g', 'ml', 'unit'],
      required: true,
      default: 'unit',
    },
  },
  { timestamps: true },
);

export default mongoose.model<RawMaterialDocument>('RawMaterial', rawMaterialSchema);
