import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as path from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const cfg = app.get(AppConfig);

  app.use(
    helmet({
      // Cho phép hiển thị ảnh SP từ /uploads trên UI cross-origin
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Serve ảnh SP: /uploads/products/:productId/:filename
  app.useStaticAssets(path.resolve(cfg.inventory.uploadDir), {
    prefix: '/uploads/',
    index: false,
  });
  app.enableCors({
    origin: cfg.corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (cfg.nodeEnv !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('MKBV CRM & Messaging API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(cfg.apiPort, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 API listening on :${cfg.apiPort} (env=${cfg.nodeEnv})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
