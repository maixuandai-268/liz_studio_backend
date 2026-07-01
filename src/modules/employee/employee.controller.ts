import { Controller, Get, Post, Req, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Req() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.employeeService.findByUserId(Number(userId));
  }

  @Get()
  async getAllEmployees() {
    return this.employeeService.findAll();
  }
  
  @Get(':id')
  async getEmployee(@Param('id') id: string) {
    return this.employeeService.findById(Number(id));
  }

  @Post()
  async createEmployee(@Body() body: any) {
    return this.employeeService.create(body);
  }

  @Put(':id')
  async updateEmployee(@Param('id') id: string, @Body() body: any) {
    return this.employeeService.update(Number(id), body);
  }

  @Delete(':id')
  async deleteEmployee(@Param('id') id: string) {
    return this.employeeService.remove(Number(id));
  }
}

