import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const timezone = process.env.APP_TIMEZONE || process.env.TZ || 'UTC';
process.env.TZ = timezone;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const allowedOriginsFromEnv = String(process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const staticAllowedOrigins = ['https://billcollection.vercel.app'];
  const allowedOrigins = new Set([...staticAllowedOrigins, ...allowedOriginsFromEnv]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowedLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
      const isAllowedProd = allowedOrigins.has(origin);

      if (isAllowedLocal || isAllowedProd) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Billing Management API')
    .setDescription(
      'Authentication and billing foundation for Admin, Collector, and Customer roles.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
}
bootstrap();
