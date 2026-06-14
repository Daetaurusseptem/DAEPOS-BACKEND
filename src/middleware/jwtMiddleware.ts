import { Response, Request, NextFunction } from 'express';
import User from '../models-mongoose/User';
import Company from '../models-mongoose/Company';
const jwt = require('jsonwebtoken');

export const verifyToken = async (req: any, resp: Response, next: NextFunction) => {
  const token = req.header('x-token');

  if (!token) {
    return resp.status(401).json({
      ok: false,
      msg: `no hay token en la validacion`,
    });
  }

  try {
    const { uid } = jwt.verify(token, process.env.JWT);
    req.uid = uid;

    // --- Verificación de Suscripción SaaS ---
    if (
      !req.originalUrl.includes('/auth/renew') &&
      !req.originalUrl.includes('/auth/demo-reset') &&
      !req.originalUrl.includes('/subs/create-checkout-session')
    ) {
      const usuarioDB = await User.findById(uid);
      if (usuarioDB && usuarioDB.role !== 'sysadmin') {
        const company = await Company.findById(usuarioDB.companyId);
        if (company) {
          if (['canceled', 'unpaid'].includes(company.subscriptionStatus || '')) {
            return resp.status(402).json({ ok: false, msg: 'Suscripción bloqueada o expirada' });
          }
          if (company.subscriptionStatus === 'past_due') {
            req.isGracePeriod = true; // El frontend puede leer esto en /auth/renew
          }
          if (
            company.currentPeriodEnd &&
            new Date() > new Date(company.currentPeriodEnd) &&
            company.subscriptionStatus !== 'past_due'
          ) {
            // Si ya pasó la fecha final del periodo y NO está en gracia, bloquea.
            // Nota: A veces past_due sobrepasa el currentPeriodEnd.
            // Para simplificar, si está en past_due siempre le damos el Soft Lock.
            // Si está cancelado, entra en el if de arriba.
          }
        }
      }
    }
    // ---------------------------------------------

    next();
  } catch (error) {
    return resp.status(401).json({
      ok: false,
      msg: `token no valido ${error}`,
    });
  }
};
export const validarAdminOrSysAdmin = async (req: any, resp: Response, next: any) => {
  const uid = req.uid;

  try {
    const usuarioDB = await User.findById(uid);

    if (!usuarioDB) {
      return resp.status(404).json({
        ok: false,
        msg: 'Usuario no existe',
      });
    }

    if (usuarioDB.role == 'user') {
      return resp.status(403).json({
        ok: false,
        msg: 'No tiene privilegios para hacer eso',
      });
    }

    next();
  } catch (error) {
    resp.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};
export const validarSysAdmin = async (req: any, resp: Response, next: any) => {
  const uid = req.uid;

  try {
    const usuarioDB = await User.findById(uid);

    if (!usuarioDB) {
      return resp.status(404).json({
        ok: false,
        msg: 'Usuario no existe',
      });
    }

    if (usuarioDB.get('role') !== 'sysadmin') {
      return resp.status(403).json({
        ok: false,
        msg: 'No tiene privilegios para hacer eso',
      });
    }

    next();
  } catch (error) {
    resp.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};
export const validarAdmin = async (req: any, resp: Response, next: any) => {
  const uid = req.uid;

  try {
    const usuarioDB = await User.findById(uid);

    if (!usuarioDB) {
      return resp.status(404).json({
        ok: false,
        msg: 'Usuario no existe',
      });
    }

    if (usuarioDB.get('role') !== 'admin') {
      return resp.status(403).json({
        ok: false,
        msg: 'No tiene privilegios para hacer eso',
      });
    }

    next();
  } catch (error) {
    resp.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

export const validarRol = (...roles: string[]) => {
  return async (req: any, resp: Response, next: NextFunction) => {
    const uid = req.uid;
    try {
      const usuarioDB = await User.findById(uid);
      if (!usuarioDB) {
        return resp.status(404).json({ ok: false, msg: 'Usuario no existe' });
      }
      if (!roles.includes(usuarioDB.role)) {
        return resp.status(403).json({ ok: false, msg: 'No tiene privilegios para hacer eso' });
      }
      next();
    } catch (error) {
      resp.status(500).json({ ok: false, msg: 'Hable con el administrador' });
    }
  };
};
export const validarUserCompany = async (req: any, resp: Response, next: any) => {
  const uid = req.uid;
  const companyId = req.params.companyId || req.body.company || req.body.companyId;

  try {
    const usuarioDB = await User.findById(uid);

    if (!usuarioDB) {
      return resp.status(404).json({
        ok: false,
        msg: 'Usuario no existe',
      });
    }

    if (
      usuarioDB.role !== 'user' &&
      usuarioDB.role !== 'sysadmin' &&
      usuarioDB.role !== 'companyAdmin' &&
      usuarioDB.role !== 'kitchen'
    ) {
      return resp.status(403).json({
        ok: false,
        msg: 'No tiene privilegios para hacer eso',
      });
    }

    if (usuarioDB.role !== 'sysadmin' && usuarioDB.companyId?.toString() !== companyId) {
      return resp.status(403).json({
        ok: false,
        msg: 'No tiene privilegios para hacer eso en esta Company',
      });
    }

    next();
  } catch (error) {
    resp.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

export const validarAdminCompany = async (req: any, resp: Response, next: any) => {
  const uid = req.uid;
  const companyId = req.params.companyId || req.body.company || req.body.companyId;

  try {
    const usuarioDB = await User.findById(uid);

    if (!usuarioDB) {
      return resp.status(404).json({
        ok: false,
        msg: 'Usuario no existe',
      });
    }

    if (usuarioDB.role === 'sysadmin') {
      return next();
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return resp.status(404).json({
        ok: false,
        msg: 'Company no existe',
      });
    }

    // Si es companyAdmin, debe ser el dueÃ±o asignado a esta Company
    if (usuarioDB.role === 'companyAdmin') {
      if (company.adminId?.toString() !== uid) {
        return resp.status(403).json({
          ok: false,
          msg: 'No tiene privilegios para acceder a esta Company',
        });
      }
      return next();
    }

    // Si es admin (gerente de sucursal), debe pertenecer a la misma Company
    if (usuarioDB.role === 'admin') {
      if (usuarioDB.companyId?.toString() !== companyId) {
        return resp.status(403).json({
          ok: false,
          msg: 'No tiene privilegios para acceder a esta Company',
        });
      }
      return next();
    }

    // Cualquier otro rol (como user) es denegado
    return resp.status(403).json({
      ok: false,
      msg: 'No tiene privilegios para hacer eso',
    });
  } catch (error) {
    resp.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

export const validarEmpresaUsuario = async (req: any, res: Response, next: NextFunction) => {
  const token = req.header('x-token') || req.headers['x-token'];
  const { companyId } = req.params;

  if (!token) {
    return res.status(401).json({
      ok: false,
      msg: 'No token provided',
    });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT);
    req.uid = decoded.uid;

    const usuarioDB = await User.findById(req.uid);
    if (!usuarioDB) {
      return res.status(404).json({
        ok: false,
        msg: 'Usuario no existe',
      });
    }

    if (usuarioDB.role === 'sysadmin') {
      return next();
    }

    const empresaDB = await Company.findById(companyId);
    if (!empresaDB) {
      return res.status(404).json({
        ok: false,
        msg: 'Company no existe',
      });
    }

    // Si es companyAdmin, verificar si es el admin asignado a la empresa
    if (usuarioDB.role === 'companyAdmin') {
      if (empresaDB.adminId?.toString() !== usuarioDB._id.toString()) {
        return res.status(403).json({
          ok: false,
          msg: 'No tiene privilegios para acceder a esta Company',
        });
      }
      return next();
    }

    // Para admin y user, verificar que pertenezcan a la empresa
    if (usuarioDB.companyId?.toString() !== companyId) {
      return res.status(403).json({
        ok: false,
        msg: 'No tiene privilegios para acceder a esta Company',
      });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      msg: 'Token invÃ¡lido o error de servidor',
    });
  }
};

export const validarSuscripcion = async (req: any, res: Response, next: NextFunction) => {
  try {
    const usuarioDB = await User.findById(req.uid);
    if (!usuarioDB) {
      return res.status(404).json({ ok: false, msg: 'Usuario no existe' });
    }
    if (usuarioDB.role === 'sysadmin') {
      return next();
    }

    const companyId = usuarioDB.companyId;
    if (!companyId) {
      return res.status(400).json({ ok: false, msg: 'El usuario no tiene una empresa asignada' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
    }

    if (
      company.subscriptionStatus === 'canceled' ||
      company.subscriptionStatus === 'unpaid' ||
      company.subscriptionStatus === 'past_due'
    ) {
      return res.status(402).json({ ok: false, msg: 'Suscripción bloqueada o expirada' });
    }

    if (company.currentPeriodEnd && new Date() > company.currentPeriodEnd) {
      return res.status(402).json({ ok: false, msg: 'Suscripción expirada' });
    }

    next();
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al validar la suscripción' });
  }
};
