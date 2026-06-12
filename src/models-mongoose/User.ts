// src/models/user.model.ts
import mongoose, { Schema, Document, now } from 'mongoose';

// Definición de la interfaz para el documento de usuario
export interface UserDocument extends Document {
  companyId?:mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'sysadmin' | 'companyAdmin' | 'kitchen';
  branch?: mongoose.Types.ObjectId;
  img? : string;
  lastLogin? : Date;
  permissions?: string[];
  isDemo?: boolean;
  active?: boolean;
  deactivationReason?: string;
}

// Esquema del modelo de usuario
const userSchema = new Schema<UserDocument>({
  username: {
    type: String,
    required: true,
    unique: true, 
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company', // Asegúrate de que esta es la referencia correcta al modelo de usuario
    required: false,
  },
  password: {
    type: String,
    required: true,
    select:false
  },
  name: String,  
  email:{
    type:String,
    required:true
  },
  role: {  
    type: String,
    enum: ['admin', 'user','sysadmin', 'companyAdmin', 'kitchen'],
    default: 'user',
    required: true,
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },
  img:{
    type:String
  },
  lastLogin:{
    type:Date,
    default:Date.now
  },
  permissions: {
    type: [String],
    default: []
  },
  isDemo: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },
  deactivationReason: {
    type: String,
    default: ''
  }
  // Define otros campos de usuario según tus necesidades
});

// Modelo de usuario
const User = mongoose.model<UserDocument>('User', userSchema);

export default User;
