import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('salary')
@UseGuards(JwtAuthGuard)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  // ── Quarters ──

  @Post('quarter')
  async createQuarter(@Body() body: { quarter: number; year: number; created_by: number }) {
    return this.salaryService.createQuarter(body);
  }

  @Get('quarters')
  async getQuarters() {
    return this.salaryService.getQuarters();
  }

  // ── Periods ──

  @Post('period')
  async createPeriod(@Body() body: { name: string; month: number; year: number; quarter?: number; pay_date?: string; created_by: number }) {
    return this.salaryService.createPeriod(body);
  }

  @Get('periods')
  async getPeriods() {
    return this.salaryService.getPeriods();
  }

  @Get('period/:id')
  async getPeriod(@Param('id') id: string) {
    return this.salaryService.getPeriod(Number(id));
  }

  @Delete('period/:id')
  async deletePeriod(@Param('id') id: string) {
    return this.salaryService.deletePeriod(Number(id));
  }

  // ── Preview (no save) ──

  @Get('preview/:periodId')
  async preview(@Param('periodId') periodId: string) {
    return this.salaryService.preview(Number(periodId));
  }

  // ── Records ──

  @Post('save/:periodId')
  async saveRecords(
    @Param('periodId') periodId: string,
    @Body() body: { records: { userId: number; bonus: number; penalty: number }[] },
  ) {
    return this.salaryService.saveRecords(Number(periodId), body.records);
  }

  @Post('calculate/:periodId')
  async calculate(@Param('periodId') periodId: string) {
    return this.salaryService.calculate(Number(periodId));
  }

  @Get('records/:periodId')
  async getRecords(@Param('periodId') periodId: string) {
    return this.salaryService.getRecords(Number(periodId));
  }

  @Get('my/:userId')
  async getMyRecords(@Param('userId') userId: string) {
    return this.salaryService.getMyRecords(Number(userId));
  }

  @Patch('record/:recordId')
  async updateRecord(
    @Param('recordId') recordId: string,
    @Body() body: { base_salary?: number; bonus?: number; penalty?: number },
  ) {
    return this.salaryService.updateRecord(Number(recordId), body);
  }

  @Patch('approve/:recordId')
  async approveRecord(
    @Param('recordId') recordId: string,
    @Body() body: { approvedBy: number },
  ) {
    return this.salaryService.approveRecord(Number(recordId), body.approvedBy);
  }

  @Post('approve-all/:periodId')
  async bulkApprove(
    @Param('periodId') periodId: string,
    @Body() body: { approvedBy: number },
  ) {
    return this.salaryService.bulkApprove(Number(periodId), body.approvedBy);
  }
}
