import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

/**
 * JwtWsAuthGuard
 *
 * WebSocket JWT authentication guard.
 */
@Injectable()
export class JwtWsAuthGuard implements CanActivate {
  private logger = new Logger('JwtWsAuthGuard');

  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    try {
      const token =
        (client.handshake.query.token as string) ||
        (client.handshake.headers.authorization as string)?.split(' ')[1];

      if (!token) {
        this.logger.warn(`[WS_AUTH] No token provided: ${client.id}`);
        throw new UnauthorizedException('No token provided');
      }

      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });

      (client.handshake as any).user = decoded;

      this.logger.log(
        `[WS_AUTH] Token verified for user ${decoded.sub}: ${client.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`[WS_AUTH] Authentication failed: ${error}`);
      client.disconnect();
      throw new UnauthorizedException('Invalid token');
    }
  }
}
