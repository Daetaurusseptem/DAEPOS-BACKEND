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
});

// Modelo de Company
const Company = mongoose.model<CompanyDocument>('Company', companySchema);

export default Company;
