import mongoose, { Document, Schema } from 'mongoose';

export interface CashExpense {
  amount: number;
  reason: string;
  type: 'withdrawal' | 'expense';
  timestamp: Date;
  depositReference?: string; // Reference of Safe Drop
  auditStatus: 'pending' | 'verified' | 'rejected';
  auditedBy?: mongoose.Types.ObjectId;
  auditedAt?: Date;
}

export interface CorteXLog {
  timestamp: Date;
  generatedBy: mongoose.Types.ObjectId;
  expectedAmount: number;
}

export interface CashRegisterDocument extends Document {
  user: mongoose.Types.ObjectId;
  physicalRegister: mongoose.Types.ObjectId; // Reference to the physical station
  company: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId; // Reference to the branch
  startDate: Date;
  endDate?: Date;
  initialAmount: number;

  // Totals calculated by the system
  expectedAmount: number; // initial + cashSales - expenses

  // Totals reported by the cashier
  actualAmount?: number; // Counted physically at closing
  difference?: number; // actual - expected
  remanenteFloatAmount?: number; // float left for change
  depositWithdrawalAmount?: number; // deposit amount

  payments: {
    cash: number;
    credit: number;
    debit: number;
  };
  expenses: CashExpense[];
  sales: mongoose.Types.ObjectId[];
  cortesX: CorteXLog[];
  notes: string;
  closed: boolean;
}

const cashExpenseSchema = new Schema<CashExpense>({
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true },
  type: { type: String, required: true, enum: ['withdrawal', 'expense'], default: 'expense' },
  timestamp: { type: Date, default: Date.now },
  depositReference: { type: String, default: '' },
  auditStatus: { type: String, required: true, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  auditedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  auditedAt: { type: Date },
});

const corteXSchema = new Schema<CorteXLog>({
  timestamp: { type: Date, default: Date.now },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expectedAmount: { type: Number, required: true },
});

const cashRegisterSchema: Schema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  physicalRegister: {
    type: Schema.Types.ObjectId,
    ref: 'PhysicalRegister',
    required: true,
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
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  initialAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  expectedAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  actualAmount: {
    type: Number,
    min: 0,
  },
  difference: {
    type: Number,
    default: 0,
  },
  remanenteFloatAmount: {
    type: Number,
    default: 0,
  },
  depositWithdrawalAmount: {
    type: Number,
    default: 0,
  },
  payments: {
    cash: { type: Number, required: true, default: 0, min: 0 },
    credit: { type: Number, required: true, default: 0, min: 0 },
    debit: { type: Number, required: true, default: 0, min: 0 },
  },
  expenses: [cashExpenseSchema],
  sales: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
    },
  ],
  cortesX: [corteXSchema],
  notes: {
    type: String,
    default: '',
  },
  closed: {
    type: Boolean,
    default: false,
  },
});

// Crear índices eficientes para consultas de auditoría y monitoreo
cashRegisterSchema.index({ branch: 1, closed: 1 });
cashRegisterSchema.index({ startDate: -1 });

export default mongoose.model<CashRegisterDocument>('CashRegister', cashRegisterSchema);
