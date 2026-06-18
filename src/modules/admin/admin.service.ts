/* eslint-disable prettier/prettier */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { ApproveSellerDto, UpdateUserStatusDto } from './dto/approve-seller.dto';
import { User } from '../users/entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

@Injectable()
export class AdminService {
  constructor(

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...rest } = user;
    return rest;
  }

  async listUsers() {
    const users = await this.userRepo.find();
    return users.map(u => this.sanitizeUser(u));
  }

  async getUserById(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return this.sanitizeUser(user);
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    if (dto.email) {
      const existed = await this.userRepo.findOne({ where: { email: dto.email, id: Not(id) } });
      if (existed) throw new ConflictException('Email đã tồn tại');
    }

    if (dto.avatarUrl) {
      const existedAvatar = await this.userRepo.findOne({ });
      if (existedAvatar) throw new ConflictException('avatarUrl đã tồn tại');
    }

    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    return this.sanitizeUser(saved);
  }

  async deleteUser(id: number) {
    const res = await this.userRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Không tìm thấy người dùng');
    return { success: true };
  }
}