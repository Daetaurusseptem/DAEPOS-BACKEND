import { Response } from 'express';
import Notification from '../models-mongoose/Notification';
import User from '../models-mongoose/User';
import SupplierRestock from '../models-mongoose/SupplierRestock';
import Supplier from '../models-mongoose/Supplier';

/**
 * Obtener notificaciones segmentadas por sucursal, rol y compañía del usuario autenticado.
 */
export const getMyNotifications = async (req: any, res: Response) => {
  try {
    const userId = req.uid;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const companyId = user.companyId || (user as any).company?._id || (user as any).company;
    if (!companyId) {
      return res.status(200).json({ ok: true, notifications: [] });
    }

    // =========================================================================
    // LÓGICA DE RECORDATORIOS EN TIEMPO REAL (AUTOMÁTICOS Y EN BASE A DÍAS PREVIOS)
    // =========================================================================
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const upcomingRestocks = await SupplierRestock.find({
        company: companyId,
        status: 'pending',
        expectedDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)), // Desde hoy a las 00:00
          $lte: threeDaysFromNow,
        },
      });

      for (const restock of upcomingRestocks) {
        const formattedDate = new Date(restock.expectedDate).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        // Comprobar si ya existe un recordatorio para este reabastecimiento en la base de datos
        const existingNotif = await Notification.findOne({
          company: companyId,
          targetBranch: restock.branch,
          title: 'Recordatorio de Entrega Próxima',
          link: `/dashboard/admin/suppliers/details/${restock.supplier}`,
        });

        if (!existingNotif) {
          const supplier = await Supplier.findById(restock.supplier);
          const supplierName = supplier ? supplier.name : 'Proveedor';

          const notif = new Notification({
            company: companyId,
            targetBranch: restock.branch,
            title: 'Recordatorio de Entrega Próxima',
            message: `El proveedor ${supplierName} tiene programado entregar en esta sucursal el día ${formattedDate}. Por favor, prepara la recepción e inspección.`,
            type: 'warning',
            link: `/dashboard/admin/suppliers/details/${restock.supplier}`,
          });
          await notif.save();
        }
      }
    } catch (reminderErr) {
      console.error('Error generating automatic restock reminders:', reminderErr);
    }

    // Filtros de responsabilidad basados en multi-inquilino y sucursales
    const notifications = await Notification.find({
      company: companyId,
      $and: [
        // Sucursal: si el usuario tiene sucursal, ve las de su sucursal o las globales
        user.branch
          ? {
              $or: [
                { targetBranch: typeof user.branch === 'object' ? (user.branch as any)._id : user.branch },
                { targetBranch: { $exists: false } },
                { targetBranch: null },
              ],
            }
          : {},
        // Usuario específico
        {
          $or: [{ targetUser: userId }, { targetUser: { $exists: false } }, { targetUser: null }],
        },
        // Rol
        {
          $or: [
            { targetRole: user.role },
            { targetRole: { $exists: false } },
            { targetRole: null },
            { targetRole: '' },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    // Mapear para incluir una bandera booleana conveniente de lectura
    const mappedNotifs = notifications.map((n) => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      createdAt: n.createdAt,
      isRead: n.readBy.includes(userId),
    }));

    return res.status(200).json({ ok: true, notifications: mappedNotifs });
  } catch (error) {
    console.error('Error in getMyNotifications:', error);
    return res.status(500).json({ ok: false, message: 'Internal server error', error });
  }
};

/**
 * Marcar una notificación específica como leída.
 */
export const markAsRead = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.uid;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ ok: false, message: 'Notification not found' });
    }

    if (!notification.readBy.includes(userId)) {
      notification.readBy.push(userId);
      await notification.save();
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error in markAsRead:', error);
    return res.status(500).json({ ok: false, message: 'Error marking notification as read', error });
  }
};

/**
 * Marcar todas las notificaciones aplicables del usuario como leídas.
 */
export const markAllAsRead = async (req: any, res: Response) => {
  try {
    const userId = req.uid;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const companyId = user.companyId || (user as any).company?._id || (user as any).company;
    if (!companyId) {
      return res.status(200).json({ ok: true });
    }

    // Encontrar todas las notificaciones no leídas para su alcance
    const notifications = await Notification.find({
      company: companyId,
      readBy: { $ne: userId },
      $and: [
        user.branch
          ? {
              $or: [
                { targetBranch: typeof user.branch === 'object' ? (user.branch as any)._id : user.branch },
                { targetBranch: { $exists: false } },
                { targetBranch: null },
              ],
            }
          : {},
        {
          $or: [{ targetUser: userId }, { targetUser: { $exists: false } }, { targetUser: null }],
        },
        {
          $or: [
            { targetRole: user.role },
            { targetRole: { $exists: false } },
            { targetRole: null },
            { targetRole: '' },
          ],
        },
      ],
    });

    // Añadir el userId al array readBy
    for (const notif of notifications) {
      notif.readBy.push(userId);
      await notif.save();
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    return res.status(500).json({ ok: false, message: 'Error marking all as read', error });
  }
};
