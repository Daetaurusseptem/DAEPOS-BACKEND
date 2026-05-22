import mongoose, { Schema, Document } from 'mongoose';

export interface RecipeIngredient {
  ingredient: mongoose.Types.ObjectId;
  quantity: number;
}

export interface RecipeDocument extends Document {
  name: string;
  description: string;
  company: mongoose.Types.ObjectId;
  ingredients: RecipeIngredient[];
}

const recipeIngredientSchema = new Schema<RecipeIngredient>({
  ingredient: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  quantity: { type: Number, required: true }
});

const recipeSchema = new Schema<RecipeDocument>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  ingredients: [recipeIngredientSchema]
});

export default mongoose.model<RecipeDocument>('Recipe', recipeSchema);
