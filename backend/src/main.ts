import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as classValidator from 'class-validator';
import * as classTransformer from 'class-transformer';

import { AllExceptionsFilter } from './common/filters/http-exception.filter';

import { Logger } from 'nestjs-pino';

import helmet from 'helmet';

import { ExpressAdapter } from '@nestjs/platform-express';
import passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    bufferLogs: true,
    rawBody: true,
  });
  app.enableShutdownHooks();
  const logger = app.get(Logger);
  app.useLogger(logger);

  const isProduction = process.env.NODE_ENV === 'production';

  // Helmet Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
            },
          }
        : false, // Disables CSP in development to preserve Swagger UI inline scripts
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Set API prefix (excluding root '/' and '/health')
  app.setGlobalPrefix('api', { exclude: ['/', 'health'] });

  // Hardened CORS policy
  const defaultAllowedOrigins = [
    'https://app.hrnexa.com',
    'https://owner.hrnexa.com',
    'http://localhost:5173',
    'http://localhost:5174',
  ];
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : defaultAllowedOrigins;

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-Correlation-ID',
    ],
  });

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      validatorPackage: classValidator,
      transformerPackage: classTransformer,
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: isProduction, // Enforces strict non-whitelisted property rejection in production
    }),
  );

  const port = process.env.PORT || 3001;
  const host = '0.0.0.0';

  // Swagger docs (Disabled in Production mode)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('HRMS API')
      .setDescription(
        'Complete Human Resource Management & Payroll System API backend documentation',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port, host);
  logger.log(
    `HRMS Backend running on http://${host}:${port} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`,
  );
  if (!isProduction) {
    logger.log(
      `Swagger documentation running on http://localhost:${port}/api/docs`,
    );
  }
  logger.log(`Health check active on http://localhost:${port}/health`);
}
void bootstrap();
