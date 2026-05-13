// src/models/supplier.model.ts

import mongoose, { Schema, Document } from 'mongoose';

  export interface SupplierDocument extends Document {
    name: string;
    description:string;
    contactInfo: {
      email: string;
      phone: string;
      address: string;
    };
    company: mongoose.Types.ObjectId; // Referencia a Company
  }

const supplierSchema = new Schema<SupplierDocument>({
  name: {
    type: String,
    required: true,
  },
  description:String,
  contactInfo: {
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
});

const Supplier = mongoose.model<SupplierDocument>('Supplier', supplierSchema);

export default Supplier;
