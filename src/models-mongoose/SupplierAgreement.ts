import mongoose from "mongoose";

interface SupplierAgreement {
    company: mongoose.Types.ObjectId;
    supplier: mongoose.Types.ObjectId;
    product: mongoose.Types.ObjectId;
    branch?: mongoose.Types.ObjectId; // Si es null, aplica globalmente (Acuerdo General)
    agreedCost: number;
    startDate: Date;
    endDate: Date;
    minimumOrderQty?: number;
    notes?: string;
    status: 'active' | 'expired' | 'draft';
}

const SupplierAgreementSchema = new mongoose.Schema<SupplierAgreement>({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        default: null
    },
    agreedCost: {
        type: Number,
        required: true,
        min: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    minimumOrderQty: {
        type: Number,
        default: 1
    },
    notes: {
        type: String
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'draft'],
        default: 'active'
    }
}, { timestamps: true });

// Índice compuesto para acelerar búsquedas
SupplierAgreementSchema.index({ company: 1, product: 1, supplier: 1, branch: 1, status: 1 });

const SupplierAgreement = mongoose.model('SupplierAgreement', SupplierAgreementSchema);

export default SupplierAgreement;
