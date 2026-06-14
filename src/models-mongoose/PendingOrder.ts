import mongoose, { Schema, Document } from 'mongoose';

export interface PendingOrderDocument extends Document {
  user: mongoose.Types.ObjectId; // Creador del ticket (Cajero / Sistema)
  waiter?: mongoose.Types.ObjectId; // Mesero asignado (In-Restaurant)
  date: Date;
  table?: string; // Identificador directo de mesa
  clientName?: string; // Nombre para llevar o comensal
  type: 'dine_in' | 'take_away' | 'delivery' | 'drive_thru';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  kitchenStatus: 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'canceled';
  payments?: {
    method: 'cash' | 'credit';
    amount: number;
    reference?: string;
    date: Date;
  }[];

  // Detalles de preparación para cocina (KDS)
  prepStartedAt?: Date;
  prepCompletedAt?: Date;
  deliveredAt?: Date;
  preparedBy?: mongoose.Types.ObjectId;

  // Detalles específicos según el modo de servicio (Drive-Thru / In-Restaurant / Delivery)
  inRestaurantDetails?: {
    guestsCount?: number; // Número de personas en la mesa
    tableId?: string; // Asignación de mesa del plano
  };

  driveThruDetails?: {
    carDescription?: string; // Ej. "Honda Civic Blanco"
    licensePlate?: string; // Placas del vehículo
    lane?: number; // Carril de atención
  };

  deliveryDetails?: {
    platform: 'uber_eats' | 'rappi' | 'didi_food' | 'phone_order' | 'custom_delivery';
    orderId: string; // Código de orden / Código ticket físico de la App
    courierName?: string; // Nombre del repartidor
    notes?: string;
  };

  productsSold: {
    product: mongoose.Types.ObjectId;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    multiplier?: number;
    modifications?: {
      name: string;
      extraPrice: number;
    }[];
    sizeName?: string;
    status?: 'pending_kitchen' | 'sent_to_kitchen' | 'canceled';
  }[];
  total: number;
  discount: number;
  company: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  cashRegister: mongoose.Types.ObjectId;
  customer?: mongoose.Types.ObjectId;
  appliedPromotion?: mongoose.Types.ObjectId;
}

const pendingOrderSchema = new Schema<PendingOrderDocument>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  waiter: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  table: {
    type: String,
  },
  clientName: {
    type: String,
  },
  type: {
    type: String,
    enum: ['dine_in', 'take_away', 'delivery', 'drive_thru'],
    default: 'dine_in',
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
    required: true,
  },
  kitchenStatus: {
    type: String,
    enum: ['pending', 'in_kitchen', 'ready', 'delivered', 'canceled'],
    default: 'pending',
    required: true,
  },
  payments: [
    {
      method: { type: String, enum: ['cash', 'credit'], required: true },
      amount: { type: Number, required: true },
      reference: { type: String },
      date: { type: Date, default: Date.now },
    },
  ],

  prepStartedAt: { type: Date },
  prepCompletedAt: { type: Date },
  deliveredAt: { type: Date },
  preparedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  inRestaurantDetails: {
    guestsCount: { type: Number, default: 1 },
    tableId: { type: String },
  },

  driveThruDetails: {
    carDescription: { type: String },
    licensePlate: { type: String },
    lane: { type: Number },
  },

  deliveryDetails: {
    platform: { type: String, enum: ['uber_eats', 'rappi', 'didi_food', 'phone_order', 'custom_delivery'] },
    orderId: { type: String },
    courierName: { type: String },
    notes: { type: String },
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
      sizeName: {
        type: String,
      },
      status: {
        type: String,
        enum: ['pending_kitchen', 'sent_to_kitchen', 'canceled'],
        default: 'pending_kitchen',
      },
    },
  ],
  total: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    required: true,
    default: 0,
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
  cashRegister: {
    type: Schema.Types.ObjectId,
    ref: 'CashRegister',
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
});

export default mongoose.model<PendingOrderDocument>('PendingOrder', pendingOrderSchema);
