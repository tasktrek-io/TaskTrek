import express, { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import path from 'path';
import { logger, httpLogger } from './utils/logger';
import { socketServer } from './socket/socketServer';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Debug environment variables
logger.debug('Environment variables loaded', {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  FROM_EMAIL: process.env.FROM_EMAIL,
  SMTP_PASS: process.env.SMTP_PASS ? '***' : undefined
});

// Import routes after environment variables are loaded
import authRouter from './routes/auth';
import workspaceRouter from './routes/workspaces';
import projectRouter from './routes/projects';
import taskRouter from './routes/tasks';
import userRouter from './routes/users';
import notificationRouter from './routes/notifications';
import contextsRouter from './routes/contexts';
import documentsRouter from './routes/documents';

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspaceRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/users', userRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/contexts', contextsRouter);
app.use('/api', documentsRouter);

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/project_mgmt';

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB', { uri: MONGO_URI });
    
    // Clean up any existing conflicting indexes
    try {
      const db = mongoose.connection.db;
      if (db) {
        await db.collection('users').dropIndex('username_1');
        logger.info('Dropped conflicting username index');
      }
    } catch (indexErr) {
      // Index doesn't exist, that's fine
    }
    
    // Initialize Socket.IO
    socketServer.initialize(httpServer);
    
    httpServer.listen(PORT, () => logger.info(`API server started`, { port: PORT, url: `http://localhost:${PORT}` }));
  } catch (err) {
    logger.error('Failed to start server', {}, err as Error);
    process.exit(1);
  }
}

start();
