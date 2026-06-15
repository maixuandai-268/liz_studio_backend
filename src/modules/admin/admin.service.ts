/* eslint-disable prettier/prettier */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { AdminUserEntity } from './entities/admin-user.entity';
import { AdminShopEntity } from './entities/admin-shop.entity';
import { ApproveSellerDto, UpdateUserStatusDto } from './dto/approve-seller.dto';

// ===== CHỈNH SỬA dữ liệu thật =====
import { User } from '../users/user.entity';
import { Shop } from '../shops/shop.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly adminUserRepo: Repository<AdminUserEntity>,
    @InjectRepository(AdminShopEntity)
    private readonly adminShopRepo: Repository<AdminShopEntity>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Shop)
    private readonly realShopRepo: Repository<Shop>,
  ) { }

  async updateUserStatus(dto: UpdateUserStatusDto) {
    return await this.adminUserRepo.update(dto.userId, { is_active: dto.is_active });
  }

  async getPendingSellers() {
    return await this.adminShopRepo.find({ where: { status: 'pending' } });
  }

  async getAllSellers() {
    return await this.adminShopRepo.find();
  }

  async getSellersByStatus(status: string) {
    return await this.adminShopRepo.find({ where: { status } });
  }

  async processSeller(dto: ApproveSellerDto) {
    const shop = await this.adminShopRepo.findOneOrFail({ where: { id: dto.sellerId } }).catch(() => {
      throw new NotFoundException('Shop không tồn tại');
    });

    await this.adminShopRepo.update(dto.sellerId, {
      status: dto.status,
      reject_reason: dto.status === 'rejected' ? (dto.reason || '') : ''
    });

    return { message: `Shop ${shop.shop_name} đã được ${dto.status}` };
  }

  async getDashboardStats() {
    const totalUsers = await this.adminUserRepo.count();
    const totalSellers = await this.adminShopRepo.count({ where: { status: 'approved' } });

    return {
      summary: [
        { label: 'Total Users', value: totalUsers, growth: '+12.5%' },
        { label: 'Active Sellers', value: totalSellers, growth: '+8.2%' },
        { label: 'Products Listed', value: 12543, growth: '+23.1%' }
      ],
      salesChart: [
        { month: 'Jan', amount: 450 },
        { month: 'Feb', amount: 580 },
        { month: 'Mar', amount: 720 },
        { month: 'Apr', amount: 690 },
        { month: 'May', amount: 850 },
        { month: 'Jun', amount: 920 }
      ],
      systemHealth: {
        uptime: '99.95%',
        latency: '145ms',
        dbLoad: '45%',
        errorRate: '0.02%'
      }
    };
  }

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
      const existedAvatar = await this.userRepo.findOne({ where: { avatarUrl: dto.avatarUrl, id: Not(id) } });
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

  async listShops() {
    return this.realShopRepo.find();
  }

  async getShopById(id: number) {
    const shop = await this.realShopRepo.findOne({ where: { id } });
    if (!shop) throw new NotFoundException('Không tìm thấy shop');
    return shop;
  }

  async updateShop(id: number, dto: UpdateShopDto) {
    const shop = await this.realShopRepo.findOne({ where: { id } });
    if (!shop) throw new NotFoundException('Không tìm thấy shop');

    if (dto.ownerId) {
      const owner = await this.userRepo.findOne({ where: { id: dto.ownerId } });
      if (!owner) throw new NotFoundException('ownerId không hợp lệ');
    }

    if (typeof dto.rating !== 'undefined' && dto.rating !== null) {
      const val = Number(dto.rating);
      if (Number.isNaN(val) || val < 0 || val > 9.9) {
        throw new ConflictException('rating phải nằm trong khoảng 0.0–9.9');
      }
      dto.rating = Math.round(val * 10) / 10;
    }

    Object.assign(shop, dto);
    return this.realShopRepo.save(shop);
  }

  async deleteShop(id: number) {
    const res = await this.realShopRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Không tìm thấy shop');
    return { success: true };
  }
}