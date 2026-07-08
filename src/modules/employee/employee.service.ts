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

  async findAll(role?: string) {
    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user');

    if (role === 'employee') {
      qb.where('user.role = :role', { role });
    }

    const emps = await qb.getMany();
    return emps;
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
    email: data.email || `${Date.now()}@lizstudio.local`,
    password: hashedPassword,
    employee_code: data.employee_code || String(Date.now()),
    role: data.role || 'employee',
  });

  const emp = this.employeeRepo.create({
    ...data,
    userId: user.id,
  });

  return this.employeeRepo.save(emp);
}

  async update(id: number | string, data: any) {
    const empId = Number(id);
    const emp = await this.employeeRepo.findOneBy({ id: empId });
    if (!emp) throw new Error(`Employee not found: ${empId}`);

    // If password is provided, hash and update on the User table
    if (data.password) {
      const hashed = await bcrypt.hash(data.password, 10);
      await this.userService.update(emp.userId, { password: hashed });
      delete data.password;
    }

    // If email is provided, update on the User table
    if (data.email) {
      await this.userService.update(emp.userId, { email: data.email });
      delete data.email;
    }

    Object.assign(emp, data);
    return this.employeeRepo.save(emp);
  }

  remove(id: number | string) {
    const empId = Number(id);
    return this.employeeRepo.delete(empId);
  }
}

