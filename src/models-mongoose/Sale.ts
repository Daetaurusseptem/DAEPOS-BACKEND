import mongoose, { Schema, Document } from 'mongoose';

export interface SaleDocument extends Document {
  user: mongoose.Types.ObjectId;
  date: Date;
  total: number;
  discount: number;
  productsSold: {
    paymentMethod: any;
    product: mongoose.Types.ObjectId;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    modifications?: {
      name: string;
      extraPrice: number;
    }[];
  }[];
  paymentMethod: 'cash' | 'credit';
  paymentReference?: string;
  receivedAmount?: number;
  change?: number;
  company: mongoose.Types.ObjectId;
  cashRegister: mongoose.Types.ObjectId;
}

const saleSchema = new Schema<SaleDocument>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  cashRegister: {
    type: Schema.Types.ObjectId,
    ref: 'CashRegister',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  total: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    required: true,
  },
  productsSold: [
    {
      product: {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      unitPrice: {
        type: Number,
        required: true,
      },
      subtotal: {
        type: Number,
        required: true,
      },
      modifications: [
        {
          name: {
            type: String,
            required: true,
          },
          extraPrice: {
            type: Number,
            required: true,
          },
        },
      ],
    },
  ],
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit'],
    required: true,
  },
  paymentReference: {
    type: String,
  },
  receivedAmount: {
    type: Number,
  },
  change: {
    type: Number,
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
});

export default mongoose.model<SaleDocument>('Sale', saleSchema);
