import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/emplyee.entity';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) {}

  async findAll() {
    return this.employeeRepo.find();
  }
  

  async findById(id: number) {
    return this.employeeRepo.findOne({ where: { id } });
  }

  async findByUserId(userId: number) {
    return this.employeeRepo.findOne({ where: { userId } });
  }

  create(data: Partial<Employee>) {
    const emp = this.employeeRepo.create(data);
    return this.employeeRepo.save(emp);
  }

  async update(id: number | string, data: any) {
    const empId = Number(id);
    const emp = await this.employeeRepo.findOneBy({ id: empId });
    if (!emp) throw new Error(`Employee not found: ${empId}`);
    Object.assign(emp, data);
    return this.employeeRepo.save(emp);
  }

  remove(id: number | string) {
    const empId = Number(id);
    return this.employeeRepo.delete(empId);
  }
}
