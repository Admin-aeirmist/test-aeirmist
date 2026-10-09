import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { logger } from '@/src/utils/logger';


// --- Error Classifications ---
export class AeirmistError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AeirmistError';
  }
}

// --- Request Tracing Middleware ---
export const requestTracer = (req: Request, res: Response, next: NextFunction) => {
  req.id = (req.headers['x-request-id'] as string) || Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Aeirmist-Trace-ID', req.id);
  next();
};

// --- Global Error Handler ---
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const traceId = req.id || 'N/A';
  const timestamp = new Date().toISOString();
  
  // 1. Error Classification
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'UNKNOWN_RESONANCE_FAILURE';
  let message = err.message || 'An unexpected error occurred..';

  // Firebase / Database Specific Handling
  if (err.code?.startsWith('auth/')) {
    statusCode = 401;
    errorCode = 'AUTH_CONNECTION_FAILED';
  } else if (err.name === 'FirebaseError' || err.code === 'permission-denied') {
    statusCode = 403;
    errorCode = 'DATABASE_ACCESS_DENIED';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'INVALID_DATA_STREAM';
  }

  // 2. Logging to server-error.log
  const logEntry = {
    timestamp,
    traceId,
    method: req.method,
    url: req.url,
    statusCode,
    errorCode,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    body: req.body,
    user: req.user?.uid || 'anonymous'
  };

  const logString = `[${timestamp}] [TRACE:${traceId}] [${req.method} ${req.url}] ERROR:${errorCode} STATUS:${statusCode} MSG:${message}\n`;
  
  fs.appendFile(path.join(process.cwd(), 'server-error.log'), logString, (fsErr) => {
    if (fsErr) logger.error('CRITICAL: Failed to write to server-error.log', fsErr);
  });

  // 3. Response Construction (Production Safe)
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      traceId,
      // Only show details in dev
      details: process.env.NODE_ENV !== 'production' ? err.details : undefined
    }
  });
};
