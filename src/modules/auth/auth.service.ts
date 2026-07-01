/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { NotificationTriggersService } from '@/modules/notifications/notification-triggers.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly notificationTriggers: NotificationTriggersService,
  ) {}

  private async scanOverdueTasks(userId: number) {
    try {
      const now = new Date();
      const rows = await this.usersService['userRepo']?.manager?.connection?.query(
        `SELECT t.id, t.title, t.deadline, p.name as project_name
         FROM tasks t
         JOIN task_assignees ta ON ta."taskId" = t.id
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE ta."userId" = $1 AND t.deadline IS NOT NULL AND t.deadline < $2 AND t.status != 'done'`,
        [userId, now],
      );
      if (!rows || rows.length === 0) return;
      for (const task of rows) {
        await this.notificationTriggers.taskOverdue(
          task.title,
          task.project_name || 'Unknown',
          userId,
        );
      }
    } catch (err) {
    }
  }

  async register(data: any) {
    const { employee_code, password, role , email , isActive } = data;
    const userExists = await this.usersService.findByEmpCode(employee_code);
    if (userExists) {
      throw new BadRequestException('Mã nhân viên đã tồn tại');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.usersService.create({
      email,
      password: hashedPassword,
      isActive : true,
      role : "employee", 
      employee_code
    });
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmpCode(dto.employee_code);
    if (!user) throw new UnauthorizedException();

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException();

    const payload = { sub: user.id, code: user.employee_code, role: user.role };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET,
    });

    await this.usersService.updateRefreshToken(user.id, refreshToken);

    this.scanOverdueTasks(user.id).catch(() => undefined);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, employee_code: user.employee_code, role: user.role },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('User not found');
      if (user.refresh_token !== refreshToken) throw new UnauthorizedException('Invalid refresh token');

      const newPayload = { sub: user.id, code: user.employee_code, role: user.role };
      const accessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });
      return { access_token: accessToken };
    } catch {
      throw new UnauthorizedException('Refresh token invalid');
    }
  }

  async logout(userId: number) {
    await this.usersService.updateRefreshToken(userId , null);
    return { message: 'Logout success' };
  }
}

