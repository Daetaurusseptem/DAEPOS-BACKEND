import mongoose, { Schema, Document } from 'mongoose';

export interface RecipeIngredient {
  ingredient: mongoose.Types.ObjectId;
  quantity: number;
}

export interface RecipeSize {
  name: string;
  priceModifier: number;
  ingredients: RecipeIngredient[];
}

export interface RecipeDocument extends Document {
  name: string;
  description: string;
  company: mongoose.Types.ObjectId;
  sizes: RecipeSize[];
}

const recipeIngredientSchema = new Schema<RecipeIngredient>({
  ingredient: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  quantity: { type: Number, required: true }
});

const recipeSizeSchema = new Schema<RecipeSize>({
  name: { type: String, required: true },
  priceModifier: { type: Number, default: 0 },
  ingredients: [recipeIngredientSchema]
});

const recipeSchema = new Schema<RecipeDocument>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  sizes: [recipeSizeSchema]
});

export default mongoose.model<RecipeDocument>('Recipe', recipeSchema);
