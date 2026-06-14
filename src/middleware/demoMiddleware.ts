import { Response, Request, NextFunction } from 'express';
import User from '../models-mongoose/User';
import jwt from 'jsonwebtoken';

export const demoBlocker = async (req: any, resp: Response, next: NextFunction) => {
  // If it's a GET request, it is completely safe to view everything!
  if (req.method === 'GET') {
    return next();
  }

  // Extract token from request headers
  const token = req.header('x-token') || req.headers['x-token'] || req.query?.token;

  if (!token) {
    return next();
  }

  try {
    // Verify token to retrieve user ID
    const decoded: any = jwt.verify(token as string, process.env.JWT as string);
    const uid = decoded.uid;

    if (!uid) {
      return next();
    }

    const usuarioDB = await User.findById(uid);
    if (!usuarioDB) {
      return next();
    }

    // Check if the user is flagged as a demo account
    if (usuarioDB.get('isDemo') === true) {
      // Allow demo reset requests
      if (req.originalUrl?.includes('/demo-reset')) {
        return next();
      }

      // 1. Block ALL delete actions to preserve seed datasets
      if (req.method === 'DELETE') {
        return resp.status(403).json({
          ok: false,
          msg: 'El borrado de datos está deshabilitado en el modo Demo para proteger el catálogo de muestra.',
        });
      }

      const url = req.originalUrl || req.url || '';

      // 2. Block modifying critical corporate configuration
      if (url.includes('/companies') || url.includes('/branches') || url.includes('/subs')) {
        if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') {
          return resp.status(403).json({
            ok: false,
            msg: 'La modificación de configuraciones corporativas, sucursales o planes está deshabilitada en el modo Demo.',
          });
        }
      }

      // 3. Block altering user security settings / roles
      if (url.includes('/users')) {
        const body = req.body || {};
        if (body.password || body.role || body.email) {
          return resp.status(403).json({
            ok: false,
            msg: 'La modificación de contraseñas, correos o roles de usuarios está deshabilitada en el modo Demo.',
          });
        }
      }
    }

    next();
  } catch (error) {
    // If token verification fails, let it pass to standard auth validation middlewares
    next();
  }
};
export default demoBlocker;
