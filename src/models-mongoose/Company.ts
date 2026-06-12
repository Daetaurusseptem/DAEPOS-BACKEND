import mongoose, { Schema, Document } from 'mongoose';

// Definición de la interfaz para el objeto de suscripción
interface Subscription {
    month: string;
    cutoffDate: Date;
    status: 'Active' | 'Inactive' | 'Pending';
    amountPaid: number;
    paymentMethod: string;
    paymentReference: string;
}

// Definición de la interfaz para el documento de Company
export interface CompanyDocument extends Document {
    name: string;
    adminId: mongoose.Types.ObjectId;
    img?: string;
    description: string;
    address: string;
    tel: string;
    email: string;
    createdAt: Date;
    SubscriptionHistory?: Subscription[];
    maxActiveRegisters: number;
    maxCashLimit: number;
    saleType: 'retail' | 'hospitality';
    isActive: boolean;
    billingType: 'stripe' | 'manual';
    subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'manual';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: Date;
    planType?: string;
    manualOverride: boolean;
    planId?: mongoose.Types.ObjectId;
    customLimitsOverrides?: {
        maxBranches?: number;
        maxUsers?: number;
        maxActiveRegisters?: number;
        features?: string[];
    };
    currentLimits?: {
        maxBranches?: number;
        maxUsers?: number;
        maxActiveRegisters?: number;
        features?: string[];
    };
    snapshotExpirationDate?: Date;
    previousSubscriptionState?: {
        status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'manual';
        currentPeriodEnd: Date;
    };
}

// Esquema del modelo de Company
const companySchema = new Schema<CompanyDocument>({
    name: {
        type: String, 
        required: true,
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Asegúrate de que esta es la referencia correcta al modelo de usuario
        required: true,
    },
    img: String,
    description: String,
    address: String,
    tel: String,
    email: String,
    createdAt: {
        type: Date,
        default: Date.now,
    },
    maxActiveRegisters: {
        type: Number,
        default: 1,
        min: 1
    },
    maxCashLimit: {
        type: Number,
        default: 5000
    },
    saleType: {
        type: String,
        enum: ['retail', 'hospitality'],
        default: 'retail'
    },
    SubscriptionHistory: [{
        month: String,
        cutoffDate: Date,
        status: {
            type: String,
            enum: ['Active', 'Inactive', 'Pending'],
            default: 'Active',
        },
        amountPaid: Number,
        paymentMethod: String,
        paymentReference: String,
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    billingType: {
        type: String,
        enum: ['stripe', 'manual'],
        default: 'stripe'
    },
    subscriptionStatus: {
        type: String,
        enum: ['active', 'past_due', 'canceled', 'unpaid', 'trialing', 'manual'],
        default: 'trialing'
    },
    stripeCustomerId: {
        type: String
    },
    stripeSubscriptionId: {
        type: String
    },
    currentPeriodEnd: {
        type: Date
    },
    planType: {
        type: String,
        default: 'basic'
    },
    manualOverride: {
        type: Boolean,
        default: false
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan'
    },
    customLimitsOverrides: {
        maxBranches: Number,
        maxUsers: Number,
        maxActiveRegisters: Number,
        features: [String]
    },
    currentLimits: {
        maxBranches: Number,
        maxUsers: Number,
        maxActiveRegisters: Number,
        features: [String]
    },
    snapshotExpirationDate: Date,
    previousSubscriptionState: {
        status: { type: String },
        currentPeriodEnd: { type: Date }
    }
});

// Modelo de Company
const Company = mongoose.model<CompanyDocument>('Company', companySchema);

export default Company;
