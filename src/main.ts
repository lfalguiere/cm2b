// src/main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Logs structurés — désactiver en prod si on utilise un agrégateur externe
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const env = config.get<string>('NODE_ENV', 'development');
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:4200');

  // ── Taille maximale du body (export/import JSON) ──────────────────────────
  app.use(express.json({ limit: '50mb' }));

  // ── Sécurité HTTP ──────────────────────────────────────────────────────────

  /**
   * Helmet pose les headers de sécurité HTTP standards :
   * CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
   *
   * On assouplit contentSecurityPolicy en dev pour permettre le HMR Angular.
   */
  app.use(
    helmet({
      contentSecurityPolicy: env === 'production',
      crossOriginEmbedderPolicy: env === 'production',
    }),
  );

  // En production NestJS sert le front sur le même domaine → CORS inutile.
  // En dev Angular tourne sur 4200 → CORS nécessaire.
  if (env !== 'production') {
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || origin === frontendUrl) {
          callback(null, true);
        } else {
          callback(new Error(`CORS bloqué pour l'origine : ${origin}`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400,
    });
  }

  // ── Préfixe global API ─────────────────────────────────────────────────────

  app.setGlobalPrefix('api/v1');

  // ── Validation globale ─────────────────────────────────────────────────────
  // (également déclaré en APP_PIPE dans AppModule pour les guards ;
  //  on le pose aussi ici pour s'assurer qu'il est actif dès le bootstrap)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Ne pas exposer les détails des erreurs en production
      disableErrorMessages: env === 'production',
    }),
  );

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`CM2B API démarrée sur http://localhost:${port}/api/v1`);
  logger.log(`Environnement : ${env}`);
}

bootstrap();
