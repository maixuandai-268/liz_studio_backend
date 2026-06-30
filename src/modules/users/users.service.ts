/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { Employee } from '../employee/entities/emplyee.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Employee)
    private empRepo: Repository<Employee>
  ) { }
 


  async findAll() {
    return this.userRepo.find({});
  }

  async findByRole() {
    return this.userRepo.find({
    });
  }

  async create(createUserDto: CreateUserDto) {
  const user = await this.userRepo.save(
    this.userRepo.create({
      employee_code: createUserDto.employee_code,
      email: createUserDto.email,
      password: createUserDto.password,
    }),
  );

  await this.empRepo.save(
    this.empRepo.create({
      userId: user.id,
    }),
  );

  return user;
}

  findByEmailWithPassword(email: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async update(id: number | string, updateUserDto: UpdateUserDto) {
    const userId = Number(id);
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`Có lỗi khi tìm id người dùng : ${userId}`);
    }

    Object.assign(user, updateUserDto);
    return await this.userRepo.save(user);
  }

  async remove(id: number | string) {
    const userId = Number(id);
    console.log("🗑️ [UsersService] Removing user with ID:", userId, "(converted from", typeof id, ")");

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      console.error("❌ [UsersService] User not found with ID:", userId);
      throw new NotFoundException(`User not found: ${userId}`);
    }

    console.log("✅ [UsersService] User found:", user.email);

    console.log("🗑️ [UsersService] Deleting user...");
    const result = await this.userRepo.delete({ id: userId });

    if (result.affected === 0) {
      console.error("❌ [UsersService] Delete affected 0 rows - something went wrong");
      throw new Error(`Delete failed: No rows affected for user ID ${userId}`);
    }

    console.log("✅ [UsersService] Delete successful - Affected rows:", result.affected);
    return result;
  }

  async findByEmpCode(employee_code : string){
    return await this.userRepo.findOneBy({employee_code : employee_code })
  }

  async findById(id: number) {
    return await this.userRepo.findOne({
      where: { id },
      relations: { employee: true },
    });
  }

  async updateRefreshToken(
  userId: number,
  refreshToken: string,
) {
  const hash = await bcrypt.hash(refreshToken, 10);

  await this.userRepo.update(userId, {
    refresh_token: hash,
  });
}
}
