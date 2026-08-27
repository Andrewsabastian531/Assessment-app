import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  // A browser never sends a trailing slash in Origin, so "https://x.app/" in
  // config would silently match nothing. Entries may use one leading wildcard
  // ("https://*.vercel.app") to cover preview deployments.
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const isAllowed = (origin: string) =>
    origins.some((allowed) =>
      allowed.includes('*')
        ? new RegExp(`^${allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')}$`).test(origin)
        : allowed === origin,
    );

  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header means a same-origin or server-side call (curl, health
      // checks); those are not subject to CORS.
      if (!origin || isAllowed(origin)) return callback(null, true);
      logger.warn(`Blocked CORS request from "${origin}". CORS_ORIGINS = ${origins.join(', ') || '(empty)'}`);
      return callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-VedaAI-Client'],
  });
  // The web app stores the API token in an httpOnly cookie, so the JWT strategy
  // needs request.cookies populated.
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  // Page images are large; the JSON limit only affects metadata payloads, but a
  // rubric with many questions can still exceed the 100kb default.
  app.useBodyParser('json', { limit: '2mb' });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  logger.log(`API listening on port ${port} under /api/v1`);
  logger.log(`CORS allows: ${origins.join(', ') || '(nothing configured)'}`);
}

void bootstrap();
