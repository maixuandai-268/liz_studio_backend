import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/emplyee.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly userService: UsersService,

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

 async create(data: CreateEmployeeDto) {
  // Hash password before saving to allow secure login
  const hashedPassword = await bcrypt.hash(data.password || '123456', 10);

  const user = await this.userService.create({
    email: data.email || `${Date.now()}@lizstudio.local`, // fallback if email is missing
    password: hashedPassword,
    employee_code: undefined,
    role: data.role || 'employee',
  });

  const emp = this.employeeRepo.create({
    ...data,
    userId: user.id,
  });

  const savedEmp = await this.employeeRepo.save(emp);

  // Update user's employee_code with the saved employee's ID as requested
  await this.userService.update(user.id, {
    employee_code: String(savedEmp.id),
  });

  return savedEmp;
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

