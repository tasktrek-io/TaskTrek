import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedSocket {
  userId: string;
  emit: (event: string, data: any) => void;
  join: (room: string) => void;
  leave: (room: string) => void;
}

class SocketServer {
  private io: Server | null = null;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  initialize(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
        credentials: true
      }
    });

    this.io.use(this.authenticateSocket);
    this.io.on('connection', this.handleConnection.bind(this));
    
    logger.info('Socket.IO server initialized');
  }

  private authenticateSocket = (socket: any, next: any) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        logger.warn('Socket authentication failed: No token provided', { socketId: socket.id });
        return next(new Error('Authentication error: No token provided'));
      }

      logger.debug('Socket authentication attempt', { socketId: socket.id, tokenLength: token.length });

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      logger.debug('JWT decoded payload', { socketId: socket.id, decoded });
      
      // Check if userId exists in the decoded token
      const userId = decoded.userId || decoded.id || decoded.user?.id || decoded.sub;
      
      if (!userId) {
        logger.error('No userId found in JWT token', { socketId: socket.id, decoded });
        return next(new Error('Authentication error: Invalid token structure'));
      }

      socket.userId = userId;
      logger.info('Socket authenticated for user', { userId, socketId: socket.id });
      next();
    } catch (err) {
      logger.error('Socket authentication failed', { socketId: socket.id }, err as Error);
      next(new Error('Authentication error: Invalid token'));
    }
  };

  private handleConnection = (socket: any) => {
    const userId = socket.userId;
    logger.info('User connected via WebSocket', { userId, socketId: socket.id });

    if (!userId) {
      logger.error('Socket connection without valid userId', { socketId: socket.id });
      socket.disconnect();
      return;
    }

    // Store the connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their personal room for notifications
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    logger.info('User joined personal room', { userId, socketId: socket.id, room: userRoom });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('User disconnected from WebSocket', { userId, socketId: socket.id });
      this.connectedUsers.delete(userId);
    });

    // Handle joining organization rooms (for organization-wide notifications)
    socket.on('join-organization', (organizationId: string) => {
      socket.join(`org:${organizationId}`);
      logger.debug('User joined organization room', { userId, organizationId });
    });

    // Handle leaving organization rooms
    socket.on('leave-organization', (organizationId: string) => {
      socket.leave(`org:${organizationId}`);
      logger.debug('User left organization room', { userId, organizationId });
    });

    // Handle joining project rooms (for project-wide notifications)
    socket.on('join-project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.debug('User joined project room', { userId, projectId });
    });

    // Handle leaving project rooms
    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.debug('User left project room', { userId, projectId });
    });
  };

  // Send notification to a specific user
  emitToUser(userId: string, event: string, data: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    const userRoom = `user:${userId}`;
    this.io.to(userRoom).emit(event, data);
    logger.info('Notification emitted to user room', { userId, event, room: userRoom, data });
  }

  // Send notification to all users in an organization
  emitToOrganization(organizationId: string, event: string, data: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to(`org:${organizationId}`).emit(event, data);
    logger.debug('Notification sent to organization', { organizationId, event, data });
  }

  // Send notification to all users in a project
  emitToProject(projectId: string, event: string, data: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to(`project:${projectId}`).emit(event, data);
    logger.debug('Notification sent to project', { projectId, event, data });
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get all connected user IDs
  getConnectedUserIds(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}

// Export singleton instance
export const socketServer = new SocketServer();
