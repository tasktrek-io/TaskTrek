import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import authRouter from './routes/auth';
import workspaceRouter from './routes/workspaces';
import projectRouter from './routes/projects';
import taskRouter from './routes/tasks';
import userRouter from './routes/users';
import notificationRouter from './routes/notifications';
import contextsRouter from './routes/contexts';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspaceRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/users', userRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/contexts', contextsRouter);

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/project_mgmt';

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Clean up any existing conflicting indexes
    try {
      const db = mongoose.connection.db;
      if (db) {
        await db.collection('users').dropIndex('username_1');
        console.log('Dropped conflicting username index');
      }
    } catch (indexErr) {
      // Index doesn't exist, that's fine
    }
    
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
