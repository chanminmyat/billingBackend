import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokensRepository: Repository<PasswordResetToken>,
  ) {}

  async issueToken(user: User): Promise<{ token: string; expiresAt: Date }> {
    const token = randomUUID();
    const tokenHash = this.hashToken(token);
    const expiresAt = this.computeExpiry();

    const entity = this.tokensRepository.create({
      tokenHash,
      expiresAt,
      user,
    });

    await this.tokensRepository.save(entity);
    return { token, expiresAt };
  }

  async validateToken(token: string): Promise<PasswordResetToken> {
    const sanitized = token.trim();
    const tokenHash = this.hashToken(sanitized);
    const record = await this.tokensRepository.findOne({
      where: { tokenHash, used: false },
      relations: { user: true },
    });

    if (!record) {
      throw new BadRequestException('Token is invalid');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token has expired');
    }

    return record;
  }

  async markAsUsed(tokenId: string): Promise<void> {
    await this.tokensRepository.update(tokenId, { used: true });
  }

  private computeExpiry(): Date {
    const minutes = Number(process.env.PASSWORD_RESET_TOKEN_MINUTES ?? 30);
    if (Number.isNaN(minutes)) {
      throw new InternalServerErrorException('Invalid token expiry configuration');
    }
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
