import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums/user-status.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Customer } from '../customers/entities/customer.entity';
import { User } from './entities/user.entity';
import { PublicUser } from './interfaces/public-user.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username
      ? dto.username.trim().toLowerCase()
      : null;
    const normalizedPhone = dto.phone ? dto.phone.trim() : null;

    await this.ensureUniqueIdentifiers({
      email: normalizedEmail,
      username: normalizedUsername,
      phone: normalizedPhone,
    });

    const passwordHash = await this.hashValue(dto.password.trim());

    const user = this.usersRepository.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      username: normalizedUsername,
      role: dto.role,
      status: dto.status ?? UserStatus.ACTIVE,
      passwordHash,
    });

    return this.usersRepository.save(user);
  }

  async buildPublicProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: {
        collectorProfile: true,
        customer: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      username: user.username ?? null,
      role: user.role,
      status: user.status,
      collectorProfile: user.collectorProfile ?? null,
      customer: user.customer ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getAllUsers(): Promise<PublicUser[]> {
    const users = await this.usersRepository.find({
      relations: {
        collectorProfile: true,
        customer: true,
      },
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      username: user.username ?? null,
      role: user.role,
      status: user.status,
      collectorProfile: user.collectorProfile ?? null,
      customer: user.customer ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  async findByIdentifierWithPassword(identifier: string): Promise<User | null> {
    const sanitized = identifier.trim();
    const normalized = sanitized.toLowerCase();
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash'])
      .where('LOWER(user.email) = :normalized', { normalized })
      .orWhere('LOWER(user.username) = :normalized', { normalized })
      .orWhere('user.phone = :sanitized', { sanitized })
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return this.usersRepository.findOne({
      where: { email: normalized },
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashValue(newPassword.trim());
    await this.usersRepository.update(userId, { passwordHash });
  }

  async removeUserById(userId: string): Promise<void> {
    await this.usersRepository.delete(userId);
  }

  async attachCustomer(userId: string, customer: Customer): Promise<User> {
    const user = await this.findEntityByIdOrFail(userId);
    user.customer = customer;
    return this.usersRepository.save(user);
  }

  async findEntityByIdOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findEntityWithCustomerOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { customer: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateAccount(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findEntityByIdOrFail(userId);

    const updates: Partial<User> = {};

    if (dto.name) {
      updates.name = dto.name.trim();
    }

    if (dto.email) {
      const normalized = dto.email.trim().toLowerCase();
      await this.assertEmailUnique(normalized, userId);
      updates.email = normalized;
    }

    if (dto.phone) {
      const normalizedPhone = dto.phone.trim();
      await this.assertPhoneUnique(normalizedPhone, userId);
      updates.phone = normalizedPhone;
    }

    if (dto.username) {
      const normalizedUsername = dto.username.trim().toLowerCase();
      await this.assertUsernameUnique(normalizedUsername, userId);
      updates.username = normalizedUsername;
    }

    if (dto.status) {
      updates.status = dto.status;
    }

    if (dto.password) {
      updates.passwordHash = await this.hashValue(dto.password.trim());
    }

    if (Object.keys(updates).length > 0) {
      await this.usersRepository.update(userId, updates);
    }

    return this.findEntityByIdOrFail(userId);
  }

  private async ensureUniqueIdentifiers(params: {
    email: string;
    username?: string | null;
    phone?: string | null;
  }) {
    await Promise.all([
      this.assertEmailUnique(params.email),
      params.username
        ? this.assertUsernameUnique(params.username)
        : Promise.resolve(),
      params.phone
        ? this.assertPhoneUnique(params.phone)
        : Promise.resolve(),
    ]);
  }

  private async assertEmailUnique(email: string, ignoreUserId?: string) {
    const existing = await this.usersRepository.findOne({
      where: { email },
    });

    if (existing && existing.id !== ignoreUserId) {
      throw new BadRequestException('Email already exists');
    }
  }

  private async assertUsernameUnique(username: string, ignoreUserId?: string) {
    if (!username) {
      return;
    }

    const existing = await this.usersRepository.findOne({
      where: { username },
    });

    if (existing && existing.id !== ignoreUserId) {
      throw new BadRequestException('Username already exists');
    }
  }

  private async assertPhoneUnique(phone: string, ignoreUserId?: string) {
    if (!phone) {
      return;
    }

    const existing = await this.usersRepository.findOne({
      where: { phone },
    });

    if (existing && existing.id !== ignoreUserId) {
      throw new BadRequestException('Phone already exists');
    }
  }

  private hashValue(value: string): Promise<string> {
    return bcrypt.hash(value, 12);
  }

}
