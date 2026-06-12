// src/controllers/saleController.ts

import { Request, Response } from 'express';
import Sale from '../models-mongoose/Sale';
import CashRegister from '../models-mongoose/CashRegister';
import InventoryItem from '../models-mongoose/InventoryItem';
import Recipe from '../models-mongoose/Recipe';
import User from '../models-mongoose/User';
import Product from '../models-mongoose/Product';
import Customer from '../models-mongoose/Customer';
import Promotion from '../models-mongoose/Promotion';
import Branch from '../models-mongoose/Branch';
import PendingOrder from '../models-mongoose/PendingOrder';
import { getIO } from '../socket';
import mongoose, { Types } from 'mongoose';

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
const deductStockForSimpleItem = async (itemId: string, quantity: number, session: any = null) => {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new Error('Item not found aca');
  item.stock -= quantity;
  if (item.stock < 0) throw new Error(`Not enough stock for item ${item.name}`);
  await item.save(session ? { session } : undefined);
};  

// Función para deducir ingredientes para un ítem compuesto
const deductIngredientsForCompositeItem = async (recipeId: any, quantity: number, branchId: any, multiplier: number = 1, session: any = null, sizeName?: string) => {
  const recipe = await Recipe.findById(recipeId).populate('sizes.ingredients.ingredient');
  if (!recipe) throw new Error('Recipe not found');

  let targetSize;
  if (sizeName) {
     targetSize = recipe.sizes.find(s => s.name === sizeName);
  }
  if (!targetSize && recipe.sizes && recipe.sizes.length > 0) {
     targetSize = recipe.sizes[0]; // Fallback al primero
  }

  if (!targetSize || !targetSize.ingredients) {
     throw new Error(`La receta no tiene ingredientes configurados para el tamaño especificado.`);
  }

  for (const recipeIngredient of targetSize.ingredients) {
      // Buscar el stock local de este ingrediente maestro en la sucursal actual
      const ingredientItem = await InventoryItem.findOne({ 
        rawMaterial: recipeIngredient.ingredient._id, 
        branch: branchId 
      });
      if (!ingredientItem) {
        throw new Error(`Insumo ${(recipeIngredient.ingredient as any).name || 'desconocido'} no está registrado en esta sucursal.`);
      }
      ingredientItem.stock -= recipeIngredient.quantity * quantity * multiplier;
      if (ingredientItem.stock < 0) {
        throw new Error(`Stock insuficiente de ${ingredientItem.name} en esta sucursal.`);
      }
      await ingredientItem.save(session ? { session } : undefined);
  }
};


// Procesar la venta y actualizar el inventario
const processSale = async (productsSold: any[], branchId: any, session: any = null) => {
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
      await deductIngredientsForCompositeItem(product.recipe, productSold.quantity, branchId, productSold.multiplier || 1, session, productSold.sizeName);
    } else {
      // Deducir el stock del ítem simple 
      await deductStockForSimpleItem(item._id.toString(), productSold.quantity, session);
    }

    // Deducir modificaciones (toppings/extras) si las hay
    if (productSold.modifications && productSold.modifications.length > 0 && item.modifications) {
      for (const soldMod of productSold.modifications) {
         const modDef = item.modifications.find(m => m.name === soldMod.name);
         if (modDef && modDef.rawMaterial && modDef.quantityToDeduct && modDef.quantityToDeduct > 0) {
             const ingredientItem = await InventoryItem.findOne({ 
               rawMaterial: modDef.rawMaterial, 
               branch: branchId 
             });
             if (ingredientItem) {
               ingredientItem.stock -= modDef.quantityToDeduct * productSold.quantity;
               if (ingredientItem.stock < 0) {
                  throw new Error(`Stock insuficiente de ${ingredientItem.name} en esta sucursal (requerido para extra: ${modDef.name}).`);
               }
               await ingredientItem.save(session ? { session } : undefined);
             }
         }
      }
    }
  }
};
 

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Crear una venta
export const createSale = async (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const session = isProd ? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  try {
    const { 

      user, total, discount, productsSold, paymentMethod, receivedAmount, 
      change, paymentReference, customerId, promotionId, pointsRedeemed 
    } = req.body;

    // Obtener la caja abierta del usuario
    const cashRegister = await CashRegister.findOne({ user, closed: false });
    if (!cashRegister) {
      throw new HttpError(400, 'No open cash register found for this user');
    }

    // Validar si la caja no ha excedido su tiempo de vida máximo
    const branchSettingsDoc = await Branch.findById(cashRegister.branch);
    const maxShiftDurationHours = branchSettingsDoc?.shiftSettings?.maxShiftDurationHours || 12;
    const hoursOpen = (new Date().getTime() - cashRegister.startDate.getTime()) / (1000 * 60 * 60);

    if (hoursOpen > maxShiftDurationHours) {
        throw new HttpError(400, `La caja ha excedido el tiempo máximo permitido de ${maxShiftDurationHours} horas. Por favor, solicita a un gerente que realice el corte de caja.`);
    }

    // Obtener el usuario y la compañía
    const userDoc = await User.findById(user).populate('companyId');
    if (!userDoc) {
      throw new HttpError(404, 'User not found');
    }

    const companyId = userDoc.companyId;
    if (!companyId) {
      throw new HttpError(400, 'User does not belong to any company');
    }

    // Obtener la sucursal del usuario
    const branchId = userDoc.branch;
    if (!branchId && userDoc.role !== 'sysadmin' && userDoc.role !== 'companyAdmin') {
      throw new HttpError(400, 'User is not assigned to any branch');
    }

    // Obtener la sucursal para leer su configuración y verificar si está activa
    const branchDoc = await Branch.findById(branchId);
    if (branchDoc && branchDoc.isActive === false) {
      throw new HttpError(403, 'La sucursal se encuentra suspendida o inactiva. No se pueden procesar ventas.');
    }

    // Procesar la venta y actualizar el inventario (pasando la sucursal y sesión)
    await processSale(productsSold, branchId, session);

    let calculatedPointsEarned = 0;
    let validatedPointsRedeemed = 0;

    // Procesar puntos y estadísticas del cliente si se seleccionó uno
    if (customerId) {
      const customerDoc = await Customer.findById(customerId);
      if (customerDoc) {
        // Solo acumular/canjear puntos si el programa está habilitado en esta sucursal
        if (branchDoc && branchDoc.loyaltySettings && branchDoc.loyaltySettings.enabled) {
          // 1. Canjear Puntos
          if (pointsRedeemed && pointsRedeemed > 0) {
            if (pointsRedeemed > customerDoc.loyaltyPoints) {
              throw new HttpError(400, 'El cliente no tiene suficientes puntos acumulados para canjear.');
            }
            customerDoc.loyaltyPoints -= pointsRedeemed;
            validatedPointsRedeemed = pointsRedeemed;
          }

          // 2. Acumular Puntos (sobre el total neto de la compra)
          const netAmount = total - (discount || 0);
          const earnRate = branchDoc.loyaltySettings.pointsEarnRate || 10;
          calculatedPointsEarned = Math.floor(netAmount / earnRate);
          if (calculatedPointsEarned > 0) {
            customerDoc.loyaltyPoints += calculatedPointsEarned;
          }
        }

        // 3. Registrar consumo histórico del cliente (independiente de si los puntos están activos)
        customerDoc.totalSpent += (total - (discount || 0));
        customerDoc.salesCount += 1;

        // 4. Ajustar el Tier del cliente automáticamente basado en consumo
        if (customerDoc.totalSpent >= 10000) {
          customerDoc.tier = 'gold';
        } else if (customerDoc.totalSpent >= 2000) {
          customerDoc.tier = 'silver';
        } else {
          customerDoc.tier = 'bronze';
        }

        await customerDoc.save(session ? { session } : undefined);
      }
    }

    // Procesar uso de promoción/cupón si aplica
    if (promotionId) {
      const promotionDoc = await Promotion.findById(promotionId);
      if (promotionDoc) {
        promotionDoc.usageCount += 1;
        await promotionDoc.save(session ? { session } : undefined);
      }
    }

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
          multiplier: product.multiplier || 1,
          modifications: product.modifications.map((mod: any) => ({
            name: mod.name,
            extraPrice: mod.extraPrice
          }))
        };
      }),
      date: new Date(),
      paymentMethod,
      company: companyId,
      branch: branchId,
      customer: customerId || undefined,
      appliedPromotion: promotionId || undefined,
      pointsRedeemed: validatedPointsRedeemed,
      pointsEarned: calculatedPointsEarned
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
    const savedSale = await newSale.save(session ? { session } : undefined);

    // HÍBRIDO: Enrutamiento Inteligente a Cocina
    // Extraer solo los productos que requieren preparación (Composite o con modificaciones)
    const kitchenItems: any[] = [];
    for (const productSold of productsSold) {
      const productDoc = await Product.findById(productSold.product);
      if (productDoc && (productDoc.isComposite || (productSold.modifications && productSold.modifications.length > 0))) {
        kitchenItems.push({
          product: productSold.product,
          productName: productDoc.name,
          quantity: productSold.quantity,
          unitPrice: productSold.unitPrice,
          subtotal: productSold.unitPrice * productSold.quantity, // Subtotal simple, luego modificadores
          modifications: productSold.modifications || [],
          status: 'sent_to_kitchen'
        });
      }
    }

    if (kitchenItems.length > 0) {
      // Calcular subtotal real de kitchenItems con mods
      kitchenItems.forEach(ki => {
         let sub = ki.unitPrice * ki.quantity;
         ki.modifications.forEach((m: any) => sub += (m.extraPrice * ki.quantity));
         ki.subtotal = sub;
      });

      let custName = 'Mostrador';
      if (customerId) {
        const cDoc = await Customer.findById(customerId);
        if (cDoc) custName = cDoc.name;
      }

      const newPendingOrder = new PendingOrder({
        user,
        cashRegister: cashRegister._id,
        table: 'Venta Directa',
        clientName: custName,
        type: 'take_away',
        kitchenStatus: 'in_kitchen',
        paymentStatus: 'paid', // Ya está pagado porque entró por Venta Directa
        company: companyId,
        branch: branchId,
        productsSold: kitchenItems,
        total: kitchenItems.reduce((acc, curr) => acc + curr.subtotal, 0),
        prepStartedAt: new Date()
      });
      const savedPending = await newPendingOrder.save(session ? { session } : undefined);
      const safeBranchId = branchId?.toString() || '';
      getIO().to(safeBranchId).emit('kds-update', savedPending);
    }

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
    await cashRegister.save(session ? { session } : undefined);

    // Verificar si se excedió el límite de efectivo configurado por la empresa
    const cashLimitExceeded = cashRegister.expectedAmount > (companyId as any).maxCashLimit;

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    return res.status(201).json({
      ...savedSale.toObject(),
      cashLimitExceeded
    });
  } catch (error: any) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    const status = error.status || 500;
    return res.status(status).json({ message: 'Error creating sale', error: error.message });
  }
};
