/* eslint-disable prettier/prettier */
import { Global, Module } from '@nestjs/common';
import { CursorService } from './services/cursor.service';

@Global()
@Module({
  providers: [CursorService],
  exports: [CursorService],
})
export class CommonModule {}
