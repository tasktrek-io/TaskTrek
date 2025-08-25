import { Request } from 'express';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  [key: string]: any;
}

class Logger {
  private logLevel: LogLevel;
  private serviceName: string;
  private environment: string;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.serviceName = process.env.SERVICE_NAME || 'api';
    this.environment = process.env.NODE_ENV || 'development';
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    switch (level) {
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARN':
        return LogLevel.WARN;
      case 'INFO':
        return LogLevel.INFO;
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'TRACE':
        return LogLevel.TRACE;
      default:
        return LogLevel.INFO;
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return istTime.toISOString().replace('T', ' ').replace('Z', ' IST');
  }

  private formatLevel(level: string, color: string): string {
    if (this.environment === 'production') {
      return level.padEnd(5);
    }
    return `${color}${level.padEnd(5)}${colors.reset}`;
  }

  private formatContext(context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return '';
    }

    const contextStr = Object.entries(context)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');

    return contextStr ? ` [${contextStr}]` : '';
  }

  private log(
    level: LogLevel,
    levelName: string,
    color: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (level > this.logLevel) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const formattedLevel = this.formatLevel(levelName, color);
    const contextStr = this.formatContext(context);

    let logMessage = `${colors.gray}${timestamp}${colors.reset} ${formattedLevel} ${colors.cyan}[${this.serviceName}]${colors.reset} ${message}${contextStr}`;

    if (error) {
      logMessage += `\n${colors.red}Error: ${error.message}${colors.reset}`;
      if (error.stack && this.environment !== 'production') {
        logMessage += `\n${colors.dim}${error.stack}${colors.reset}`;
      }
    }

    console.log(logMessage);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, 'ERROR', colors.red, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'WARN', colors.yellow, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'INFO', colors.green, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'DEBUG', colors.blue, message, context);
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, 'TRACE', colors.magenta, message, context);
  }

  // HTTP request logging helper
  http(req: Request, statusCode: number, responseTime: number): void {
    const context: LogContext = {
      method: req.method,
      url: req.originalUrl,
      status: statusCode.toString(),
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')?.substring(0, 100),
    };

    // Add user ID if available (from auth middleware)
    if ((req as any).user?.id) {
      context.userId = (req as any).user.id;
    }

    const level = statusCode >= 400 ? 'warn' : 'info';
    const message = `${req.method} ${req.originalUrl} ${statusCode}`;

    this[level](message, context);
  }

  // Database operation logging
  db(operation: string, collection: string, duration?: number, context?: LogContext): void {
    const dbContext: LogContext = {
      operation,
      collection,
      ...(duration && { duration: `${duration}ms` }),
      ...context,
    };

    this.debug(`Database ${operation}`, dbContext);
  }

  // Service operation logging
  service(serviceName: string, operation: string, context?: LogContext): void {
    const serviceContext: LogContext = {
      service: serviceName,
      operation,
      ...context,
    };

    this.info(`Service operation`, serviceContext);
  }

  // Security logging
  security(event: string, context?: LogContext): void {
    const securityContext: LogContext = {
      event,
      ...context,
    };

    this.warn(`Security event: ${event}`, securityContext);
  }
}

// Create singleton instance
export const logger = new Logger();

// Express middleware for HTTP logging
export const httpLogger = (req: Request, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(req, res.statusCode, duration);
  });

  next();
};

export default logger;
