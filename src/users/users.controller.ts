import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectorsService } from '../collectors/collectors.service';
import { CustomersService } from '../customers/customers.service';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateUserDetailsDto } from './dto/update-user-details.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly collectorsService: CollectorsService,
    private readonly customersService: CustomersService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a user with associated profile' })
  getUser(@Param('id') id: string) {
    return this.usersService.buildPublicProfile(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with associated profiles' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user account and profile details' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDetailsDto,
  ) {
    let user = dto.account
      ? await this.usersService.updateAccount(id, dto.account)
      : await this.usersService.findEntityByIdOrFail(id);

    if (dto.collectorProfile) {
      if (user.role !== UserRole.COLLECTOR) {
        throw new BadRequestException('User is not a collector');
      }

      await this.collectorsService.upsertProfile(user, dto.collectorProfile);
    }

    if (dto.customer) {
      if (user.role !== UserRole.CUSTOMER) {
        throw new BadRequestException('User is not a customer');
      }

      const userWithCustomer = await this.usersService.findEntityWithCustomerOrFail(
        id,
      );

      if (!userWithCustomer.customer) {
        throw new BadRequestException('Customer record not found');
      }

      await this.customersService.updateCustomer(
        userWithCustomer.customer.id,
        dto.customer,
      );
    }

    return this.usersService.buildPublicProfile(id);
  }
}
