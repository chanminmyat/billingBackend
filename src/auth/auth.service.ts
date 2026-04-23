import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CollectorsService } from '../collectors/collectors.service';
import { CustomersService } from '../customers/customers.service';
import { PasswordResetService } from '../password-reset/password-reset.service';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { CreateAccountBaseDto } from '../users/dto/create-account-base.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly collectorsService: CollectorsService,
    private readonly customersService: CustomersService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByIdentifierWithPassword(
      dto.identifier,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }

    const isValidPassword = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const profile = await this.usersService.buildPublicProfile(user.id);
    return {
      message: 'Login successful',
      user: profile,
    };
  }

  async createCollectorAccount(dto: CreateCollectorDto) {
    const { collector } = dto;
    if (!collector) {
      throw new BadRequestException('Collector details are required');
    }

    const collectorCode = await this.collectorsService.generateCollectorCode();
    const password = this.extractNrcPassword(collector.nrc);
    const username = collectorCode;

    const user = await this.usersService.createUser({
      name: collector.name,
      email: collector.email,
      phone: collector.phone,
      username,
      password,
      role: UserRole.COLLECTOR,
      status: this.mapUserStatus(collector.status),
    });

    await this.collectorsService.createCollectorProfileFromIntake(
      user,
      collectorCode,
      collector,
    );

    return this.usersService.buildPublicProfile(user.id);
  }

  async createCustomerAccount(dto: CreateCustomerDto) {
    const { customer } = dto;
    if (!customer) {
      throw new BadRequestException('Customer details are required');
    }

    let createdCustomerId: string | null = null;
    let createdUserId: string | null = null;

    try {
      const customerCode = await this.customersService.generateCustomerCode();
      const customerRecord = await this.customersService.createCustomerFromIntake(
        customer,
        customerCode,
      );
      createdCustomerId = customerRecord.id;

      const { email, name, nrc } = this.extractUserCredentials(customer, customerCode);
      const username = customerCode;
      const password = nrc;

      const user = await this.usersService.createUser({
        name,
        email,
        phone: customer.contactInformation.primaryPhone,
        username,
        password,
        role: UserRole.CUSTOMER,
        status: UserStatus.INACTIVE,
      });
      createdUserId = user.id;

      await this.usersService.attachCustomer(user.id, customerRecord);

      const plan = await this.customersService.createPlanFromIntake(customer);
      const subscription = await this.customersService.createSubscriptionFromIntake(
        customerRecord,
        plan,
        customer,
      );

      await this.customersService.createNetworkFromIntake(subscription, customer);

      const shouldCreateInitialInvoice = customer.createInvoiceNow !== false;
      if (shouldCreateInitialInvoice) {
        await this.customersService.createBillFromIntake(
          customerRecord,
          subscription,
          customer,
        );
      }

      return this.usersService.buildPublicProfile(user.id);
    } catch (error) {
      if (createdUserId) {
        try {
          await this.usersService.removeUserById(createdUserId);
        } catch {
          // Best effort rollback.
        }
      }
      if (createdCustomerId) {
        try {
          await this.customersService.removeCustomerById(createdCustomerId);
        } catch {
          // Best effort rollback.
        }
      }
      throw error;
    }
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tokenPayload = await this.passwordResetService.issueToken(user);
    return {
      message: 'Password reset token generated',
      ...tokenPayload,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenRecord = await this.passwordResetService.validateToken(
      dto.token,
    );

    await this.usersService.updatePassword(tokenRecord.user.id, dto.newPassword);
    await this.passwordResetService.markAsUsed(tokenRecord.id);

    return { message: 'Password updated successfully' };
  }

  async changePassword(dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdentifierWithPassword(
      dto.identifier,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }

    const matchesCurrent = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!matchesCurrent) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }

    await this.usersService.updatePassword(user.id, dto.newPassword);
    return { message: 'Password updated successfully' };
  }

  private buildCreateUserPayload(
    dto: CreateAccountBaseDto,
    role: UserRole,
  ): CreateUserDto {
    return {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      username: dto.username,
      status: dto.status,
      password: dto.password,
      role,
    };
  }

  private extractUserCredentials(
    customerPayload: CreateCustomerDto['customer'],
    customerCode: string,
  ) {
    if (!customerPayload) {
      throw new BadRequestException('Customer details are required');
    }

    const rawEmail = customerPayload.contactInformation.email?.trim();
    const email = rawEmail && rawEmail.length > 0 ? rawEmail : `${customerCode.toLowerCase()}@customers.local`;

    const isIndividual = customerPayload.customerType === 'individual';
    const name = isIndividual
      ? customerPayload.personalInformation?.name
      : customerPayload.businessInformation?.companyName;
    const nrc = isIndividual
      ? customerPayload.personalInformation?.nrc
      : customerPayload.businessInformation?.contactNrc;

    if (!name) {
      throw new BadRequestException('Customer name is required');
    }

    if (!nrc) {
      throw new BadRequestException('NRC is required to generate password');
    }

    const digits = nrc.replace(/\D/g, '');
    if (digits.length < 6) {
      throw new BadRequestException('NRC must include at least 6 digits');
    }

    const password = digits.slice(-6);
    return { email, name, nrc: password };
  }

  private extractNrcPassword(nrc: string): string {
    const digits = nrc.replace(/\D/g, '');
    if (digits.length < 6) {
      throw new BadRequestException('NRC must include at least 6 digits');
    }
    return digits.slice(-6);
  }

  private mapUserStatus(status?: string): UserStatus {
    if (status === 'disable' || status === 'takeoff' || status === 'pending') {
      return UserStatus.INACTIVE;
    }

    return UserStatus.ACTIVE;
  }
}
