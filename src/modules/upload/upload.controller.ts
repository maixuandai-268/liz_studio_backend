/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
 
/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Delete,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { DeleteFileDto } from './dto/delete-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';


@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadFile(file);
  }

  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadService.uploadMultiple(files);
  }

  @Patch()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  async update(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpdateFileDto,
  ) {
    return this.uploadService.updateFile(
      file,
      body.old_public_id,
      body.resource_type,
    );
  }

  @Delete()
  async delete(@Body() body: DeleteFileDto) {
    return this.uploadService.deleteFile(
      body.public_id,
      'image',
    );
  }
}

