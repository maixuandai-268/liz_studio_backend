import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, Raw } from 'typeorm';
import { AttendanceRecord } from './entities/attendance-records.entity';
import { User } from '../users/entities/user.entity';
import { Employee } from '../employee/entities/emplyee.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationTriggersService } from '../notifications/notification-triggers.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { CreateCheckOutDto } from './dto/create-check-out.dto';
import { ApproveAttendanceDto } from './dto/approve-attendance.dto';
import {
  START_HOUR,
  START_MINUTE,
  WORKDAY_MINUTES,
  LATE_GRACE_MINUTES,
  WORKDAYS,
  isWithinGeoRange,
} from './constants';

@Injectable()
export class AttendanceService {
  private logger = new Logger('AttendanceService');

  constructor(
    @InjectRepository(AttendanceRecord)
    private attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
    private realtimeService: RealtimeService,
    private notificationTriggers: NotificationTriggersService,
  ) {}

  private async fireLateCheckInNotif(userId: number, notes: string) {
    try {
      const emp = await this.employeeRepo.findOne({ where: { userId } } as any);
      const name = (emp as any)?.full_name || `User #${userId}`;
      await this.notificationTriggers.lateCheckIn(name, notes || '');
    } catch (err) {
      this.logger.error(`[NOTIF] lateCheckIn error: ${(err as any).message}`);
    }
  }

  private todayString(): string {
    const now = new Date();

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
    }).format(now);
}

  private localNow(): Date {
    const now = new Date();
    const dateStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const [date, time] = dateStr.split(' ');
    const [y, m, d] = date.split('-').map(Number);
    const [h, min, s] = time.split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, h, min, s));
  }

  private toLocalTime(date: Date) {
    const vnStr = date.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const time = vnStr.split(' ')[1];
    const [h, m] = time.split(':').map(Number);
    return { h, m };
  }

  private isWorkDay(date: Date): boolean {
    return WORKDAYS.includes(date.getDay());
  }

  private countWorkdaysInMonth(year: number, monthIndex: number): number {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, monthIndex, d).getDay();
      if (WORKDAYS.includes(day)) count++;
    }
    return count;
  }

  private monthBounds(year: number, month: number): [string, string] {
    const m = String(month).padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    return [`${year}-${m}-01`, `${year}-${m}-${String(daysInMonth).padStart(2, '0')}`];
  }

  private calculateLateMinutes(checkIn: Date): number {
    const { h, m } = this.toLocalTime(checkIn);
    const startTotal = START_HOUR * 60 + START_MINUTE;
    const checkInTotal = h * 60 + m;
    const rawLate = Math.max(0, checkInTotal - startTotal);
    if (rawLate <= LATE_GRACE_MINUTES) return 0;
    return rawLate;
  }

  private calculateStatus(lateMinutes: number, hasCheckOut: boolean, workingMinutes: number): string {
    if (!hasCheckOut) return 'checkin';
    if (lateMinutes > LATE_GRACE_MINUTES && workingMinutes < WORKDAY_MINUTES * 0.5) return 'kl';
    if (lateMinutes > 0) return 'm';
    return 'x';
  }

  async checkIn(userId: number, projectId: string, dto: CreateCheckInDto) {
    const today = this.todayString();

    const now = this.localNow();
    if (!this.isWorkDay(now)) {
      throw new BadRequestException('Hôm nay là Chủ nhật, không phải ngày làm việc');
    }

    if (!dto.latitude || !dto.longitude) {
      throw new BadRequestException('Cần có tọa độ GPS để chấm công');
    }
    if (!isWithinGeoRange(dto.latitude, dto.longitude)) {
      throw new BadRequestException(
        'Bạn đang ở ngoài khu vực chấm công (cách công ty hơn 150m)',
      );
    }

    const existing = await this.attendanceRepo.findOne({
      where: { userId, attendanceDate: today } as any,
    });
    if (existing) {
      throw new BadRequestException('Bạn đã điểm danh hôm nay rồi');
    }

    const checkInTime = new Date();
    const lateMinutes = this.calculateLateMinutes(checkInTime);
    const status = lateMinutes > 0 ? 'm' : 'x';

    const record = this.attendanceRepo.create({
      userId,
      attendanceDate: today,
      checkIn: checkInTime,
      status,
      lateMinutes,
      checkinLat: dto.latitude,
      checkinLng: dto.longitude,
      notes: dto.notes || null,
    });

    const saved = await this.attendanceRepo.save(record);

    this.realtimeService.emitTaskEvent(projectId, 'created' as any, {
      type: 'attendance.checkin',
      userId,
      attendanceDate: today,
      status: saved.status,
      checkIn: saved.checkIn,
      lateMinutes: saved.lateMinutes,
    });

    this.logger.log(
      `[CHECKIN] User ${userId} at ${checkInTime.toISOString()} — ${status} (late: ${lateMinutes}min) — geo: ${dto.latitude},${dto.longitude}`,
    );

    if (lateMinutes > 0) {
      this.fireLateCheckInNotif(userId, dto.notes).catch(e => this.logger.error(`[NOTIF] ${e.message}`));
    }

    this.employeeRepo.update({ userId }, { employment_status: true } as any).catch(e => this.logger.error(`[empStatus] ${e.message}`));

    return saved;
  }

  async checkOut(userId: number, projectId: string, dto: CreateCheckOutDto) {
    const today = this.todayString();

    const record = await this.attendanceRepo.findOne({
      where: { userId, attendanceDate: today } as any,
    });
    if (!record) {
      throw new BadRequestException('Bạn chưa check-in hôm nay');
    }
    if (record.checkOut) {
      throw new BadRequestException('Bạn đã check-out hôm nay rồi');
    }

    const now = new Date();
    record.checkOut = now;

    if (dto.latitude && dto.longitude) {
      (record as any).checkinLat = dto.latitude;
      (record as any).checkinLng = dto.longitude;
    }

    const msDiff = now.getTime() - record.checkIn.getTime();
    record.workingMinutes = Math.round(msDiff / 60000);

    if (dto.notes) record.notes = dto.notes;
    if (dto.evidenceUrl) record.evidenceUrl = dto.evidenceUrl;

    record.status = this.calculateStatus(
      record.lateMinutes,
      true,
      record.workingMinutes,
    );

    const saved = await this.attendanceRepo.save(record);

    this.realtimeService.emitTaskEvent(projectId, 'updated' as any, {
      type: 'attendance.checkout',
      userId,
      attendanceDate: today,
      status: saved.status,
      checkIn: saved.checkIn,
      checkOut: saved.checkOut,
      workingMinutes: saved.workingMinutes,
    });

    this.logger.log(
      `[CHECKOUT] User ${userId} at ${now.toISOString()} — worked ${record.workingMinutes}min`,
    );

    this.employeeRepo.update({ userId }, { employment_status: false } as any).catch(e => this.logger.error(`[empStatus] ${e.message}`));

    return saved;
  }

  async getMyHistory(userId: number, limit = 30) {
    const records = await this.attendanceRepo.find({
      where: { userId } as any,
      order: { attendanceDate: 'DESC' } as any,
      take: limit,
    }) as unknown as AttendanceRecord[];

    return records;
  }

  // Optimized: query only current month instead of all records
  async getMyStats(userId: number) {
    const today = this.todayString();
    const currentDate = this.localNow();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    // Query only current month records
    const [allRecords, todayRecord] = await Promise.all([
      this.attendanceRepo.find({
        where: { userId, attendanceDate: Between(...this.monthBounds(year, month)) } as any,
      }) as unknown as AttendanceRecord[],
      this.attendanceRepo.findOne({
        where: { userId, attendanceDate: today } as any,
      }) as unknown as AttendanceRecord | null,
    ]);

    const totalWorkDays = allRecords.length;
    const lateDays = allRecords.filter((r) => r.status === 'm').length;
    const absentDays = allRecords.filter((r) => r.status === 'kl' || r.status === 'o').length;
    const totalOtMinutes = allRecords.reduce(
      (sum, r) => sum + Math.max(0, (r.workingMinutes || 0) - WORKDAY_MINUTES),
      0,
    );
    const totalWorkingMinutes = allRecords.reduce(
      (sum, r) => sum + (r.workingMinutes || 0),
      0,
    );

    const workdaysInMonth = this.countWorkdaysInMonth(year, currentDate.getMonth());
    const attendanceRate = workdaysInMonth > 0
      ? Math.round(((totalWorkDays - absentDays) / workdaysInMonth) * 100)
      : 0;

    const lateTrend = await this.getLateTrend(userId);

    return {
      today: todayRecord || null,
      month: {
        totalWorkDays,
        lateDays,
        absentDays,
        totalOtMinutes,
        totalWorkingMinutes,
        attendanceRate,
      },
      lateTrend,
    };
  }

  // Optimized: single query per month instead of 3 full table scans
  private async getLateTrend(userId: number) {
    const now = this.localNow();
    const results: { month: string; count: number }[] = [];

    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const [start, end] = this.monthBounds(d.getFullYear(), d.getMonth() + 1);
      const records = await this.attendanceRepo.find({
        where: { userId, attendanceDate: Between(start, end) } as any,
      }) as unknown as AttendanceRecord[];

      const count = records.filter((r) => r.status === 'm').length;
      results.push({ month: monthNames[d.getMonth()], count });
    }

    return results;
  }

  // Optimized: filter at DB level instead of fetching all
  async getMonthGrid(year: number, month: number) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const [start, end] = this.monthBounds(year, month);

    const [employees, monthRecords] = await Promise.all([
      this.employeeRepo
        .createQueryBuilder('employee')
        .leftJoinAndSelect('employee.user', 'user')
        .where('user.role = :role', { role: 'employee' })
        .getMany() as unknown as Employee[],
      this.attendanceRepo.find({
        where: { attendanceDate: Between(start, end) } as any,
      }) as unknown as AttendanceRecord[],
    ]);

    const daysInMonth = new Date(year, month, 0).getDate();

    // Build lookup map: userId -> attendance records
    const recordsByUser = new Map<number, AttendanceRecord[]>();
    for (const r of monthRecords) {
      if (!recordsByUser.has(r.userId)) recordsByUser.set(r.userId, []);
      recordsByUser.get(r.userId)!.push(r);
    }

    const grid = employees.map((emp) => {
      const userRecords = recordsByUser.get(emp.userId) ?? [];

      // Build date lookup within user records
      const recordByDate = new Map<string, AttendanceRecord>();
      for (const r of userRecords) {
        recordByDate.set(r.attendanceDate, r);
      }

      const days: Record<number, { status: string; checkIn?: string; checkOut?: string }> = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const record = recordByDate.get(dateStr);

        if (record) {
          days[d] = {
            status: record.status,
            checkIn: record.checkIn?.toISOString(),
            checkOut: record.checkOut?.toISOString(),
          };
        } else if (dayOfWeek === 0) {
          days[d] = { status: 'w' };
        } else {
          days[d] = { status: 'o' };
        }
      }

      return {
        id: emp.id,
        userId: emp.userId,
        fullName: emp.full_name,
        avatarUrl: emp.avatar_url,
        position: emp.position,
        days,
      };
    });

    return {
      year,
      month,
      daysInMonth,
      employees: grid,
    };
  }

  // Optimized: filter at DB level instead of fetching all
  async getMonthlySummary(year: number, month: number) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const [start, end] = this.monthBounds(year, month);

    const [employees, monthRecords] = await Promise.all([
      this.employeeRepo
        .createQueryBuilder('employee')
        .leftJoinAndSelect('employee.user', 'user')
        .where('user.role = :role', { role: 'employee' })
        .getMany() as unknown as Employee[],
      this.attendanceRepo.find({
        where: { attendanceDate: Between(start, end) } as any,
      }) as unknown as AttendanceRecord[],
    ]);

    // Group by userId
    const recordsByUser = new Map<number, AttendanceRecord[]>();
    for (const r of monthRecords) {
      if (!recordsByUser.has(r.userId)) recordsByUser.set(r.userId, []);
      recordsByUser.get(r.userId)!.push(r);
    }

    const summary = employees.map((emp) => {
      const userRecords = recordsByUser.get(emp.userId) ?? [];
      const totalDays = userRecords.length;
      const lateDays = userRecords.filter((r) => r.status === 'm').length;
      const unpaidDays = userRecords.filter((r) => r.status === 'kl').length;
      const absentDays = userRecords.filter((r) => r.status === 'o').length;
      const workingDays = userRecords.filter((r) => r.status === 'x').length;
      const totalWorkingMinutes = userRecords.reduce((s, r) => s + (r.workingMinutes || 0), 0);

      const workdays = this.countWorkdaysInMonth(year, month - 1);
      const efficiency = workdays > 0
        ? Math.round((workingDays / workdays) * 100)
        : 0;

      const totalOtMinutes = userRecords.reduce(
        (s, r) => s + Math.max(0, (r.workingMinutes || 0) - WORKDAY_MINUTES),
        0,
      );

      return {
        id: emp.id,
        userId: emp.userId,
        fullName: emp.full_name,
        avatarUrl: emp.avatar_url,
        totalDays,
        workingDays,
        lateDays,
        unpaidDays,
        absentDays,
        totalWorkingMinutes,
        totalOtMinutes,
        efficiency,
      };
    });

    return {
      year,
      month,
      weekdays: this.countWorkdaysInMonth(year, month - 1),
      employees: summary,
    };
  }

  // Optimized: batch-load employees
  async getByDate(dateStr: string) {
    const records = await this.attendanceRepo.find({
      where: { attendanceDate: dateStr } as any,
      order: { checkIn: 'ASC' } as any,
    }) as unknown as AttendanceRecord[];

    if (records.length === 0) return [];

    // Batch-load all employees at once
    const userIds = [...new Set(records.map(r => r.userId))];
    const employees = await this.employeeRepo.find({
      where: { userId: In(userIds) } as any,
    }) as unknown as Employee[];
    const empMap = new Map(employees.map(e => [e.userId, e]));

    return records.map((r) => {
      const emp = empMap.get(r.userId);
      return {
        ...r,
        employeeName: emp?.full_name || 'Unknown',
        employeeAvatar: emp?.avatar_url || '',
      };
    });
  }

  // Optimized: filter at DB level
  async getUserRecords(userId: number, year?: number, month?: number) {
    if (year && month) {
      return this.attendanceRepo.find({
        where: { userId, attendanceDate: Between(...this.monthBounds(year, month)) } as any,
        order: { attendanceDate: 'DESC' } as any,
      }) as unknown as AttendanceRecord[];
    }

    return this.attendanceRepo.find({
      where: { userId } as any,
      order: { attendanceDate: 'DESC' } as any,
    }) as unknown as AttendanceRecord[];
  }

  async approveRecord(recordId: number, adminUserId: number, dto: ApproveAttendanceDto) {
    const record = await this.attendanceRepo.findOne({
      where: { id: recordId } as any,
    });
    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi chấm công');
    }

    if (dto.status) record.status = dto.status;
    if (dto.notes) record.notes = dto.notes;
    record.approvedBy = adminUserId;

    const saved = await this.attendanceRepo.save(record);

    this.logger.log(
      `[ATTENDANCE] Record ${recordId} approved by ${adminUserId} — status: ${saved.status}`,
    );
    return saved;
  }
}
