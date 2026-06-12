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
    multiplier?: number;
    modifications?: {
      name: string;
      extraPrice: number;
    }[];
  }[];
  paymentMethod: 'cash' | 'credit' | 'mixed';
  payments?: {
    method: 'cash' | 'credit';
    amount: number;
    reference?: string;
    date: Date;
  }[];
  paymentReference?: string;
  receivedAmount?: number;
  change?: number;
  company: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  cashRegister: mongoose.Types.ObjectId;
  customer?: mongoose.Types.ObjectId;
  appliedPromotion?: mongoose.Types.ObjectId;
  pointsRedeemed?: number;
  pointsEarned?: number;
  
  // Detalles rápidos para pedidos de delivery
  deliveryDetails?: {
    platform: 'uber_eats' | 'rappi' | 'didi_food' | 'phone_order' | 'custom_delivery';
    orderId: string;
    courierName?: string;
    notes?: string;
  };
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
      multiplier: {
        type: Number,
        default: 1,
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
    enum: ['cash', 'credit', 'mixed'],
    required: true,
  },
  payments: [
    {
      method: { type: String, enum: ['cash', 'credit'], required: true },
      amount: { type: Number, required: true },
      reference: { type: String },
      date: { type: Date, default: Date.now }
    }
  ],
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
  branch: {
    type: Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
  },
  appliedPromotion: {
    type: Schema.Types.ObjectId,
    ref: 'Promotion',
  },
  pointsRedeemed: {
    type: Number,
    default: 0,
  },
  pointsEarned: {
    type: Number,
    default: 0,
  },
  deliveryDetails: {
    platform: { type: String, enum: ['uber_eats', 'rappi', 'didi_food', 'phone_order', 'custom_delivery'] },
    orderId: { type: String },
    courierName: { type: String },
    notes: { type: String }
  },
});

export default mongoose.model<SaleDocument>('Sale', saleSchema);
