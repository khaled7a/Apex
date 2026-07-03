import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransitionExceptionFilter } from './transition-engine/transition-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new TransitionExceptionFilter());
  // Only the web portals need credentialed cross-origin access (browser JS
  // never reaches the API directly today for most calls — see the frontend's
  // Next.js proxy design — but a few, like health checks, may).
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001', credentials: true });

  const config = new DocumentBuilder()
    .setTitle('Apex Sourcing API')
    .setDescription('Reference implementation of docs/state-machine.md and docs/data-model.md')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
