const isProd = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production')
  || Boolean((globalThis as any)?.__PROD_ENV__);

const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'credential', 
  'session', 'card', 'key', 'private',
  'billing', 'stripe', 'auth', '2fa'
];

const sanitize = (data: any, seen?: WeakSet<object>, depth = 0): any => {
  if (data === undefined || data === null) return data;
  if (typeof data !== 'object') return data;
  if (depth > 4) return '[MaxDepth]';

  const safeSeen = (seen && typeof (seen as any).has === 'function') ? seen : new WeakSet<object>();
  if (safeSeen.has(data)) return '[Circular]';
  safeSeen.add(data);

  if (Array.isArray(data)) return data.map(item => sanitize(item, safeSeen, depth + 1));
  if (data instanceof Error) {
    return {
      message: data.message,
      name: data.name,
      code: (data as any).code || 'UNKNOWN_ERROR',
      // Explicitly omit stack trace in prod for security, keep in dev
      stack: isProd ? undefined : data.stack
    };
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    
    if (SENSITIVE_KEYS.some(sk => keyLower.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (keyLower === 'user' || keyLower === 'profile' || keyLower === 'account') {
      sanitized[key] = value && typeof value === 'object' 
        ? { id: (value as any).uid || (value as any).id, role: (value as any).role }
        : value;
    } else {
      sanitized[key] = sanitize(value, safeSeen, depth + 1);
    }
  }
  return sanitized;
};

export const logger = {
  debug: (message: any, ...args: any[]) => {
    if (!isProd) {
      console.debug(`[DEBUG] ${typeof message === 'string' ? message : ''}`, ...[typeof message === 'string' ? undefined : message, ...args].filter(Boolean).map(x => sanitize(x)));
    }
  },
  info: (message: any, ...args: any[]) => {
    if (!isProd) {
      console.info(`[INFO] ${typeof message === 'string' ? message : ''}`, ...[typeof message === 'string' ? undefined : message, ...args].filter(Boolean).map(x => sanitize(x)));
    }
  },
  warn: (message: any, ...args: any[]) => {
    console.warn(`[WARN] ${typeof message === 'string' ? message : ''}`, ...[typeof message === 'string' ? undefined : message, ...args].filter(Boolean).map(x => sanitize(x)));
  },
  error: (message: any, ...args: any[]) => {
    console.error(`[ERROR] ${typeof message === 'string' ? message : ''}`, ...[typeof message === 'string' ? undefined : message, ...args].filter(Boolean).map(x => sanitize(x)));
  },
  security: (message: any, ...args: any[]) => {
    console.info(`[SECURITY] ${typeof message === 'string' ? message : ''}`, ...[typeof message === 'string' ? undefined : message, ...args].filter(Boolean).map(x => sanitize(x)));
  }
};
