/* eslint-disable prettier/prettier */
import { Injectable, BadRequestException } from '@nestjs/common';

export interface CursorPayload {
  createdAt: string;
  id: number;
}

@Injectable()
export class CursorService {
  encode(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  decode(cursor: string): CursorPayload {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded) as CursorPayload;

      if (typeof payload.createdAt !== 'string' || typeof payload.id !== 'number') {
        throw new Error('Invalid cursor payload structure');
      }

      return payload;
    } catch (error) {
      throw new BadRequestException('Invalid cursor provided');
    }
  }
}
