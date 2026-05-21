// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ValidationPipe } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// Entités
import {
  ElementType,
  ElementClass,
  AttributeDefinition,
  Element,
  AttributeValue,
  Relation,
  User,
  RefreshToken,
  DocumentRevision,
  ViewElementPosition,
} from './entities';

// Modules fonctionnels
import { AuthModule } from './auth/auth.module';
import { ElementClassesModule } from './elementclasses/elementclasses.module';
import { MapModule } from './map/map.module';
import { ViewModule } from './view/view.module';
import { AdminModule } from './admin/admin.module';

// Guards globaux
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DB_PATH', 'cm2b.sqlite'),
        entities: [
          ElementType,
          ElementClass,
          AttributeDefinition,
          Element,
          AttributeValue,
          Relation,
          User,
          RefreshToken,
          DocumentRevision,
          ViewElementPosition,
        ],
        synchronize: config.get('TYPEORM_SYNC') !== 'false',
        migrationsRun: false,
        logging: config.get('DB_LOGGING') === 'true' ? ['query', 'error'] : ['error'],
        extra: {
          pragma: {
            journal_mode: 'WAL',
            foreign_keys: 'ON',
            busy_timeout: 5000,
          },
        },
      }),
    }),

    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 120 },
    ]),

    // Sert les fichiers statiques Angular compilés (prod uniquement — en dev Angular tourne sur 4200)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client', 'dist', 'cm2b-app', 'browser'),
      exclude: ['/api/{*path}'],
      renderPath: '/*',
    }),

    AuthModule,
    ElementClassesModule,
    MapModule,
    ViewModule,
    AdminModule,
  ],

  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}
