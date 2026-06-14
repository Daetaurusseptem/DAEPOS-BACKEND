import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Permitir todas las conexiones para simplificar en dev
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Cliente WS conectado: ${socket.id}`);

    // Los clientes (KDS) pueden unirse a una "sala" (room) específica para su sucursal
    socket.on('join-branch-room', (branchId: string) => {
      socket.join(branchId);
      console.log(`Socket ${socket.id} unido a la sala branch: ${branchId}`);
    });

    // Nueva sala global para usuarios (incluye permisos/roles para notificaciones)
    socket.on('join-user-rooms', (data: { userId: string; companyId: string; branchId?: string; role?: string }) => {
      const { userId, companyId, branchId, role } = data;

      if (userId) socket.join(`user-${userId}`);
      if (companyId) socket.join(`company-${companyId}`);
      if (branchId) socket.join(`branch-${branchId}`);
      if (role && companyId) socket.join(`role-${role}-${companyId}`);

      console.log(
        `Socket ${socket.id} unido a las salas: user-${userId}, company-${companyId}, branch-${branchId}, role-${role}-${companyId}`,
      );
    });

    socket.on('disconnect', () => {
      console.log(`Cliente WS desconectado: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    console.warn('Advertencia: Socket.io no está inicializado! Se intentó obtener getIO().');
  }
  return io;
};
