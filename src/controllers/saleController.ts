// src/controllers/saleController.ts

import { Request, Response } from 'express';
import Sale from '../models-mongoose/Sale';
import CashRegister from '../models-mongoose/CashRegister';
import InventoryItem from '../models-mongoose/InventoryItem';
import Recipe from '../models-mongoose/Recipe';
import User from '../models-mongoose/User';
import Product from '../models-mongoose/Product'; // Importar el modelo Product para acceder a sus campos
import { Types } from 'mongoose';

// Obtener todas las ventas
export const getAllSales = async (req: Request, res: Response) => {
  try {
      const { branchId, companyId } = req.query;
      let query: any = {};
      
      if (companyId) query.company = companyId;
      if (branchId) query.branch = branchId;

      const sales = await Sale.find(query).populate('user').populate('productsSold.product');
      res.status(200).json(sales);
  } catch (error) {
      res.status(500).json({ message: error });
  } 
};


// Obtener una venta por ID
export const getSaleById = async (req: Request, res: Response) => {
  try {
      const sale = await Sale.findById(req.params.id).populate('user').populate('productsSold.product');
      if (!sale) return res.status(404).json({ message: 'Venta no encontrada' });
      res.status(200).json({ ok: true, sale });
  } catch (error) {
      res.status(500).json({ message: error });
  }
};

// Función para deducir el stock de un ítem simple
const deductStockForSimpleItem = async (itemId: string, quantity: number) => {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new Error('Item not found aca');
  item.stock -= quantity;
  if (item.stock < 0) throw new Error(`Not enough stock for item ${item.name}`);
  await item.save();
};  

// Función para deducir ingredientes para un ítem compuesto
const deductIngredientsForCompositeItem = async (recipeId: any, quantity: number) => {
  const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
  if (!recipe) throw new Error('Recipe not found');
  for (const recipeIngredient of recipe.ingredients) {
      const ingredient = await InventoryItem.findById(recipeIngredient.ingredient._id);
      if (!ingredient) throw new Error('Ingredient not found');
      ingredient.stock -= recipeIngredient.quantity * quantity;
      if (ingredient.stock < 0) throw new Error(`Not enough ${ingredient.name} in stock`);
      await ingredient.save();
  }
};


// Procesar la venta y actualizar el inventario
const processSale = async (productsSold: any[], branchId: any) => {
  for (const productSold of productsSold) {
    // Utilizar el ID del producto y la sucursal para encontrar el item correcto
    const item = await InventoryItem.findOne({ product: productSold.product, branch: branchId }).populate('product');
    if (!item) throw new Error(`Item for product ${productSold.product} not found in branch ${branchId}`);
    
    // Buscar el producto para verificar si es compuesto
    const product = await Product.findById((item.product as any)._id);
    if (!product) throw new Error('Product not found');

    // Verificar si el producto es compuesto y deducir los ingredientes si es necesario
    if (product.isComposite) { 
      if (!product.recipe) throw new Error('Composite product does not have a recipe');
      await deductIngredientsForCompositeItem(product.recipe, productSold.quantity);
    } else {
      // Deducir el stock del ítem simple 
      await deductStockForSimpleItem(item._id.toString(), productSold.quantity);
    }
  }
};
 

// Crear una venta
export const createSale = async (req: Request, res: Response) => {
  try {
    const { user, total, discount, productsSold, paymentMethod, receivedAmount, change, paymentReference } = req.body;

    // Obtener la caja abierta del usuario
    const cashRegister = await CashRegister.findOne({ user, closed: false });
    if (!cashRegister) {
      return res.status(400).json({ message: 'No open cash register found for this user' });
    }

    // Obtener el usuario y la compañía
    const userDoc = await User.findById(user).populate('companyId');
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const companyId = userDoc.companyId;
    if (!companyId) {
      return res.status(400).json({ message: 'User does not belong to any company' });
    }

    // Obtener la sucursal del usuario
    const branchId = userDoc.branch;
    if (!branchId && userDoc.role !== 'sysadmin' && userDoc.role !== 'companyAdmin') {
      return res.status(400).json({ message: 'User is not assigned to any branch' });
    }

    // Procesar la venta y actualizar el inventario (pasando la sucursal)
    await processSale(productsSold, branchId);

    // Crear una nueva venta con los datos proporcionados
    const newSaleData: any = {
      user,
      cashRegister: cashRegister._id, // Vincular a la sesión de caja
      total,
      discount,
      productsSold: productsSold.map((product: any) => {
        // Calcular el subtotal del producto considerando las modificaciones
        let subtotal = product.unitPrice * product.quantity;

        if (product.modifications && product.modifications.length > 0) {
          product.modifications.forEach((mod: any) => {
            subtotal += mod.extraPrice * product.quantity;
          });
        }

        return {
          product: product.product,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          subtotal,
          modifications: product.modifications.map((mod: any) => ({
            name: mod.name,
            extraPrice: mod.extraPrice
          }))
        };
      }),
      date: new Date(),
      paymentMethod,
      company: companyId,
      branch: branchId
    };

    // Añadir información adicional según el método de pago
    if (paymentMethod === 'cash') {
      newSaleData.receivedAmount = receivedAmount;
      newSaleData.change = change;
    } else if (paymentMethod === 'credit') {
      newSaleData.paymentReference = paymentReference;
    }

    // Guardar la nueva venta en la base de datos
    const newSale = new Sale(newSaleData);
    const savedSale = await newSale.save();

    // Actualizar los pagos en la caja
    let cashTotal = 0;
    let creditTotal = 0;
    let debitTotal = 0;

    productsSold.forEach((product: any) => {
      let subtotal = product.unitPrice * product.quantity;
      if (product.modifications && product.modifications.length > 0) {
        product.modifications.forEach((mod: any) => {
          subtotal += mod.extraPrice * product.quantity;
        });
      }

      switch (paymentMethod) {
        case 'cash':
          cashTotal += subtotal;
          break;
        case 'credit':
          creditTotal += subtotal;
          break;
        case 'debit':
          debitTotal += subtotal;
          break;
        default:
          throw new Error('Invalid payment method');
      }
    });

    // Actualizar acumuladores de la caja
    cashRegister.payments.cash += cashTotal;
    cashRegister.payments.credit += creditTotal;
    cashRegister.payments.debit += debitTotal;
    
    // El dinero esperado solo aumenta con ventas en EFECTIVO (cash)
    cashRegister.expectedAmount += cashTotal;

    // Agregar la venta a la caja
    cashRegister.sales.push(savedSale._id as any);

    // Guardar los cambios en la caja
    await cashRegister.save();

    // Verificar si se excedió el límite de efectivo configurado por la empresa
    const cashLimitExceeded = cashRegister.expectedAmount > (companyId as any).maxCashLimit;

    return res.status(201).json({
      ...savedSale.toObject(),
      cashLimitExceeded
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating sale', error: (error as Error).message });
  }
};
