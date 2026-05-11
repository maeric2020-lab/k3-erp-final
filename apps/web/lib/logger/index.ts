/**
 * Logger مركزي للتطبيق.
 *
 * في الـ development: يطبع للـ console بألوان.
 * في الـ production: يكتب JSON منظَّم لـ stdout (Vercel يلتقطها) ويرسل
 *                    الأخطاء إلى Sentry إذا كان مُكوَّناً.
 *
 * استخدامه:
 *   import { logger } from '@/lib/logger';
 *   logger.info('user.login', { userId, email });
 *   logger.error('payment.failed', err, { invoiceId });
 *
 * الـ event name (الأول) دائماً snake.dotted لتسهيل البحث.
 */

import { isProduction } from '@/lib/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  ts: string;
  level: LogLevel;
  event: string;
  message?: string;
  ctx?: LogContext;
  err?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function format(entry: LogEntry): string {
  if (isProduction) {
    // JSON منظَّم لـ Vercel logs / Datadog / إلخ
    return JSON.stringify(entry);
  }
  // ملوّن للـ development
  const colors: Record<LogLevel, string> = {
    debug: '\x1b[90m', // رمادي
    info: '\x1b[36m',  // أزرق فاتح
    warn: '\x1b[33m',  // أصفر
    error: '\x1b[31m', // أحمر
  };
  const reset = '\x1b[0m';
  const ctxStr = entry.ctx && Object.keys(entry.ctx).length > 0
    ? ' ' + JSON.stringify(entry.ctx)
    : '';
  const errStr = entry.err
    ? `\n  ${entry.err.name}: ${entry.err.message}${entry.err.stack ? '\n' + entry.err.stack : ''}`
    : '';
  return `${colors[entry.level]}[${entry.level.toUpperCase()}]${reset} ${entry.event}${entry.message ? ' — ' + entry.message : ''}${ctxStr}${errStr}`;
}

function log(level: LogLevel, event: string, arg2?: Error | LogContext, arg3?: LogContext) {
  let err: LogEntry['err'];
  let ctx: LogContext | undefined;
  let message: string | undefined;

  if (arg2 instanceof Error) {
    err = {
      name: arg2.name,
      message: arg2.message,
      stack: arg2.stack,
    };
    message = arg2.message;
    ctx = arg3;
  } else if (arg2) {
    ctx = arg2;
  }

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    message,
    ctx,
    err,
  };

  // Vercel/Cloud logs
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(format(entry));

  // إرسال إلى Sentry — يُفعَّل فعلياً في 8ج عند ربط SDK
  // الآن نسجّل فقط hook بسيط للتأكد من البنية صحيحة
  if (level === 'error' && isProduction && typeof globalThis !== 'undefined') {
    const w = globalThis as any;
    if (w.Sentry?.captureException && err) {
      const e = new Error(err.message);
      e.name = err.name;
      e.stack = err.stack;
      w.Sentry.captureException(e, { extra: ctx, tags: { event } });
    }
  }
}

export const logger = {
  debug: (event: string, arg2?: Error | LogContext, arg3?: LogContext) => log('debug', event, arg2, arg3),
  info: (event: string, arg2?: Error | LogContext, arg3?: LogContext) => log('info', event, arg2, arg3),
  warn: (event: string, arg2?: Error | LogContext, arg3?: LogContext) => log('warn', event, arg2, arg3),
  error: (event: string, arg2?: Error | LogContext, arg3?: LogContext) => log('error', event, arg2, arg3),
} as const;
