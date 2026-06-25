import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { CreateCheckOutDto } from './dto/create-check-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { ApproveAttendanceDto } from './dto/approve-attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ── Employee: Check-in ──

  @Post('checkin')
  async checkIn(@Req() req, @Body(ValidationPipe) dto: CreateCheckInDto) {
    const user = req.user as { id: number };
    const projectId = String(req.headers['x-project-id'] || '1');
    return this.attendanceService.checkIn(user.id, projectId, dto);
  }

  // ── Employee: Check-out ──

  @Patch('checkout')
  async checkOut(@Req() req, @Body(ValidationPipe) dto: CreateCheckOutDto) {
    const user = req.user as { id: number };
    const projectId = String(req.headers['x-project-id'] || '1');
    return this.attendanceService.checkOut(user.id, projectId, dto);
  }

  // ── Employee: My History ──

  @Get('me')
  async getMyHistory(@Req() req) {
    const user = req.user as { id: number };
    return this.attendanceService.getMyHistory(user.id);
  }

  // ── Employee: My Stats ──

  @Get('stats/me')
  async getMyStats(@Req() req) {
    const user = req.user as { id: number };
    return this.attendanceService.getMyStats(user.id);
  }

  // ── Admin: Month Grid (bảng chấm công) ──

  @Get('grid')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getMonthGrid(@Query(ValidationPipe) query: AttendanceQueryDto) {
    const year = query.year || new Date().getFullYear();
    const month = query.month || new Date().getMonth() + 1;
    return this.attendanceService.getMonthGrid(year, month);
  }

  // ── Admin: Monthly Summary ──

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getMonthlySummary(@Query(ValidationPipe) query: AttendanceQueryDto) {
    const year = query.year || new Date().getFullYear();
    const month = query.month || new Date().getMonth() + 1;
    return this.attendanceService.getMonthlySummary(year, month);
  }

  // ── Admin: Records by Date ──

  @Get('date')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getByDate(@Query(ValidationPipe) query: AttendanceQueryDto) {
    const date = query.date || new Date().toISOString().split('T')[0];
    return this.attendanceService.getByDate(date);
  }

  // ── Admin: User Records ──

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getUserRecords(
    @Param('userId') userId: string,
    @Query(ValidationPipe) query: AttendanceQueryDto,
  ) {
    return this.attendanceService.getUserRecords(
      Number(userId),
      query.year,
      query.month,
    );
  }

  // ── Admin: Approve / Edit Record ──

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async approveRecord(
    @Param('id') id: string,
    @Req() req,
    @Body(ValidationPipe) dto: ApproveAttendanceDto,
  ) {
    const user = req.user as { id: number };
    return this.attendanceService.approveRecord(Number(id), user.id, dto);
  }
}
