/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../shops/shop.entity'; 

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    
    @InjectRepository(Shop)
    private readonly shopsRepository: Repository<Shop>,
  ) {}

  async register(data: any) {
    const { email, password, displayName } = data;

    const userExists = await this.usersService.findByEmail(email);
    if (userExists) {
      throw new BadRequestException('Email đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.usersService.create({
      email,
      password: hashedPassword,
      displayName,
      role: 'user', 
    });
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    const userShop = await this.shopsRepository.findOne({ 
      where: { ownerId: user.id } 
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role, 
      shopId: userShop ? userShop.id : null 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        shopId: userShop ? userShop.id : null 
      }
    };
  }
}