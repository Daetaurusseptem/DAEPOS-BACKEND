import mongoose from 'mongoose';

interface Category {
  company: mongoose.Types.ObjectId;
  name: string;
  description: string;
  isOperational: boolean;
}

const CategorySchema = new mongoose.Schema<Category>(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    isOperational: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

CategorySchema.index({ company: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', CategorySchema);

export default Category;
