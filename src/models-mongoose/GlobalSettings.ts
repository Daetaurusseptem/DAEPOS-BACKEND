import mongoose, { Schema, Document } from 'mongoose';

export interface GlobalSettingsDocument extends Document {
  bankInstructions: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    clabe: string;
    extraNotes: string;
  };
  contactEmail: string;
  updatedAt: Date;
}

const globalSettingsSchema = new Schema<GlobalSettingsDocument>({
  bankInstructions: {
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    clabe: { type: String, default: '' },
    extraNotes: { type: String, default: '' }
  },
  contactEmail: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<GlobalSettingsDocument>('GlobalSettings', globalSettingsSchema);
