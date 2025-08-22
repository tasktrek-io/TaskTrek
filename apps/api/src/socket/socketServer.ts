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
  private userProfiles: Map<string, any> = new Map(); // userId -> user profile data

  initialize(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
        credentials: true
      },
      // Essential timeout settings for AWS deployment
      pingTimeout: 60000, // 60 seconds
      pingInterval: 25000, // 25 seconds
      transports: ['websocket', 'polling']
    });

    this.io.use(this.authenticateSocket);
    this.io.on('connection', this.handleConnection.bind(this));
    
    logger.info('Socket.IO server initialized with AWS timeout settings');
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

    // Store the connection and user profile
    this.connectedUsers.set(userId, socket.id);
    
    // Store user profile data from JWT for online status
    const decoded = jwt.decode(socket.handshake.auth.token) as any;
    if (decoded) {
      this.userProfiles.set(userId, {
        _id: userId,
        id: userId,
        name: decoded.name || 'Unknown User',
        email: decoded.email || '',
        isOnline: true,
        lastSeen: new Date()
      });
    }

    // Join user to their personal room for notifications
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    logger.info('User joined personal room', { userId, socketId: socket.id, room: userRoom });

    // Broadcast user online status to organization and project rooms
    this.broadcastUserStatus(userId, true);

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('User disconnected from WebSocket', { userId, socketId: socket.id });
      this.connectedUsers.delete(userId);
      
      // Update user profile offline status
      const userProfile = this.userProfiles.get(userId);
      if (userProfile) {
        userProfile.isOnline = false;
        userProfile.lastSeen = new Date();
      }
      
      // Broadcast user offline status
      this.broadcastUserStatus(userId, false);
    });

    // Handle joining organization rooms (for organization-wide notifications)
    socket.on('join-organization', (organizationId: string) => {
      socket.join(`org:${organizationId}`);
      logger.info('User joined organization room', { userId, organizationId, room: `org:${organizationId}` });
      
      // Send current online users in this organization
      this.sendOnlineUsersToRoom(socket, `org:${organizationId}`);
    });

    // Handle leaving organization rooms
    socket.on('leave-organization', (organizationId: string) => {
      socket.leave(`org:${organizationId}`);
      logger.info('User left organization room', { userId, organizationId, room: `org:${organizationId}` });
    });

    // Handle joining project rooms (for project-wide notifications)
    socket.on('join-project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.info('User joined project room', { userId, projectId, room: `project:${projectId}` });
      
      // Send current online users in this project
      this.sendOnlineUsersToRoom(socket, `project:${projectId}`);
    });

    // Handle leaving project rooms
    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.info('User left project room', { userId, projectId, room: `project:${projectId}` });
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

  // Get online users with profile data
  getOnlineUsers(): any[] {
    return Array.from(this.userProfiles.values()).filter(user => user.isOnline);
  }

  // Check if specific user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Broadcast user status change to all relevant rooms
  private broadcastUserStatus(userId: string, isOnline: boolean) {
    if (!this.io) return;

    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) return;

    const statusData = {
      userId,
      isOnline,
      lastSeen: userProfile.lastSeen,
      user: {
        _id: userId,
        id: userId,
        name: userProfile.name,
        email: userProfile.email
      }
    };

    // Broadcast to all organization and project rooms
    // This is a simple approach - in production you might want to be more selective
    this.io.emit('userStatusChange', statusData);
    
    logger.debug('User status broadcasted', { userId, isOnline });
  }

  // Send current online users to a socket when they join a room
  private sendOnlineUsersToRoom(socket: any, roomName: string) {
    if (!this.io) return;

    const onlineUsers = this.getOnlineUsers();
    socket.emit('onlineUsers', { room: roomName, users: onlineUsers });
    
    logger.info('Online users sent to room', { room: roomName, count: onlineUsers.length, userIds: onlineUsers.map(u => u._id || u.id) });
  }

  // Get online status for specific users
  getOnlineStatusForUsers(userIds: string[]): { [userId: string]: boolean } {
    const status: { [userId: string]: boolean } = {};
    userIds.forEach(userId => {
      status[userId] = this.isUserOnline(userId);
    });
    return status;
  }
}

// Export singleton instance
export const socketServer = new SocketServer();
