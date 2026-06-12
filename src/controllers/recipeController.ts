import { Request, Response } from 'express';
import Recipe from '../models-mongoose/Recipe';
import InventoryItem from '../models-mongoose/InventoryItem';

export const createRecipe = async (req: Request, res: Response) => {
  try {
    const {companyId} = req.params;
    req.body.company = companyId;
    const recipe = new Recipe(req.body);
    await recipe.save();
    res.status(201).json(recipe);
  } catch (error) {
    res.status(500).json({ message: 'Error creating recipe', error });
  }
};

export const getRecipes = async (req: Request, res: Response) => {
  try {
    const recipes = await Recipe.find().populate('sizes.ingredients.ingredient');
    res.status(200).json(recipes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recipes', error });
  }
};

export const consumeIngredients = async (req: Request, res: Response) => {
  try {
    const { recipeId, quantity, sizeName } = req.body;

    const recipe = await Recipe.findById(recipeId).populate('sizes.ingredients.ingredient');
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    let targetSize;
    if (sizeName) {
       targetSize = recipe.sizes.find(s => s.name === sizeName);
    }
    if (!targetSize && recipe.sizes && recipe.sizes.length > 0) {
       targetSize = recipe.sizes[0];
    }

    if (!targetSize || !targetSize.ingredients) {
       return res.status(400).json({ message: 'La receta no tiene ingredientes configurados para el tamaño especificado.' });
    }

    for (const recipeIngredient of targetSize.ingredients) {
      const inventoryItem = await InventoryItem.findById(recipeIngredient.ingredient._id);
      if (inventoryItem) {
        inventoryItem.stock -= recipeIngredient.quantity * quantity;
        if (inventoryItem.stock < 0) {
          return res.status(400).json({ message: `Not enough ${inventoryItem.name} in stock` });
        }
        await inventoryItem.save();
      }
    }

    res.status(200).json({ message: 'Ingredients consumed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error consuming ingredients', error });
  }
};
