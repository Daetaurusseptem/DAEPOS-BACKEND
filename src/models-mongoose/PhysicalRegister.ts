import mongoose, { Schema, Document } from 'mongoose';

export interface PhysicalRegisterDocument extends Document {
  name: string;
  description?: string;
  company: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
}

const physicalRegisterSchema = new Schema<PhysicalRegisterDocument>({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure a company cannot have two registers with the same name
physicalRegisterSchema.index({ name: 1, company: 1 }, { unique: true });

export default mongoose.model<PhysicalRegisterDocument>('PhysicalRegister', physicalRegisterSchema);
