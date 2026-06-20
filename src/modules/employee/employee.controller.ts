import { Controller, Get, Req, Put, Delete, Param, Body } from '@nestjs/common';
import { EmployeeService } from './employee.service';

@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  async getAllEmployees() {
    return this.employeeService.findAll();
  }
  

  @Get(':id')
  async getEmployee(@Param('id') id: string) {
    return this.employeeService.findById(Number(id));
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
