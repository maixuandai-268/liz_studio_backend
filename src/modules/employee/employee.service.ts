/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/emplyee.entity';
import { UpdateEmployeeDto } from './dto/update-employee.dto';


@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) { }

  findByEmail(full_name: string) {
    return this.employeeRepo.findOne({ where: { full_name } });
  }

  async findAll() {
    return this.employeeRepo.find({
    });
  }

  async findByRole() {
    return this.employeeRepo.find({
    });
  }

  create(data: Partial<Employee>) {
    const user = this.employeeRepo.create(data);
    return this.employeeRepo.save(user);
  }

  findByEmailWithPassword(email: string) {
    return this.employeeRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async update(id: number | string, updateEmployeeDto: UpdateEmployeeDto) {
    const userId = Number(id);
    const user = await this.employeeRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`Có lỗi khi tìm id người dùng : ${userId}`);
    }

    Object.assign(user, updateEmployeeDto);
    return await this.employeeRepo.save(user);
  }

    remove(id: number | string) {
    const userId = Number(id);
    console.log("🗑️ [UsersService] Removing user with ID:", userId, "(converted from", typeof id, ")");
  }

  findById(id: number) {
    return this.employeeRepo.findOne({ where: { id } });
  }
}