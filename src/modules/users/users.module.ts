/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserController } from './users.controller';
import { Employee } from '../employee/entities/emplyee.entity';
import { EmployeeService } from '../employee/employee.service';

@Module({
  imports: [TypeOrmModule.forFeature([User,Employee])],
  controllers: [UserController],
  providers: [UsersService,EmployeeService],
  exports: [UsersService],
})
export class UsersModule { }

