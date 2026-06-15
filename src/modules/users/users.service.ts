/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) { }

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  async findAll() {
    return this.userRepo.find({
      relations: ['shop'], // giữ giống findById nếu bạn cần
    });
  }

  async findByRole(role: string) {
    return this.userRepo.find({
      where: { role: role as any },
      relations: ['shop'],
    });
  }

  create(data: Partial<User>) {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
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

    // 1. Find user
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      console.error("❌ [UsersService] User not found with ID:", userId);
      throw new NotFoundException(`User not found: ${userId}`);
    }

    console.log("✅ [UsersService] User found:", user.email);

    // 2. Delete associated shop first (to avoid FK constraint)
    try {
      console.log("🗑️ [UsersService] Checking for associated shop...");
      const shopRepository = this.userRepo.manager.getRepository('Shop');
      const shopDeleteResult = await shopRepository.delete({ ownerId: userId });
      if (shopDeleteResult.affected && shopDeleteResult.affected > 0) {
        console.log("✅ [UsersService] Deleted", shopDeleteResult.affected, "shop(s)");
      } else {
        console.log("ℹ️ [UsersService] No shops found for this user");
      }
    } catch (err) {
      console.warn("⚠️ [UsersService] Failed to delete shops:", err.message);
      // Continue with user deletion even if shop deletion fails
    }

    // 3. Delete user
    console.log("🗑️ [UsersService] Deleting user...");
    const result = await this.userRepo.delete({ id: userId });

    if (result.affected === 0) {
      console.error("❌ [UsersService] Delete affected 0 rows - something went wrong");
      throw new Error(`Delete failed: No rows affected for user ID ${userId}`);
    }

    console.log("✅ [UsersService] Delete successful - Affected rows:", result.affected);
    return result;
  }

  findById(id: number) {
    return this.userRepo.findOne({
      where: { id },
      relations: ['shop'],
    });
  }
}