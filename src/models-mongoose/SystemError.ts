import mongoose, { Schema, Document } from 'mongoose';

export interface SystemErrorDocument extends Document {
  companyId?: mongoose.Types.ObjectId;
  route?: string;
  method?: string;
  errorMessage: string;
  stackTrace?: string;
  timestamp: Date;
  status?: number;
}

const systemErrorSchema = new Schema<SystemErrorDocument>({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
  },
  route: String,
  method: String,
  errorMessage: {
    type: String,
    required: true,
  },
  stackTrace: String,
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 1296000, // 15 days in seconds (15 * 24 * 3600)
  },
  status: Number,
});

const SystemError = mongoose.model<SystemErrorDocument>('SystemError', systemErrorSchema);
export default SystemError;
