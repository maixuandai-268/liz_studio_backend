import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ChannelService } from './modules/chat/channels/channel.service';
import cookieParser = require('cookie-parser');


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const channelService = app.get(ChannelService);
  await channelService.initializeDefaultChannels();

  app.use(json({ limit: '200mb' }));
  app.use(urlencoded({ extended: true, limit: '200mb' }));


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  app.enableCors({
  origin: [
    "http://localhost:3001",
    "http://10.4.4.56:3001",
    "https://lizstudio.net"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

    app.use(cookieParser());

  const PORT = process.env.PORT || 3000;

  // await app.listen(PORT,  "0.0.0.0");
  await app.listen(PORT);
}
bootstrap();
