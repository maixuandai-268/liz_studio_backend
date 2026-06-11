/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from './modules/upload/upload.module';
import { ProjectModule } from './modules/project/project.module';
require('dotenv').config();

const password = process.env.DB_PASSWORD || '';


@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: password,
      database: 'liz_studio',
      autoLoadEntities: true,
      synchronize: true,
    }),
    UploadModule,
    ProjectModule
  ],
})
export class AppModule { };
