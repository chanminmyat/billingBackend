import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';

async function bootstrap() {
  const logger = new Logger('SeedAdmin');
  const appContext = await NestFactory.createApplicationContext(AppModule);

  try {
    const usersService = appContext.get(UsersService);

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME ?? 'System Admin';

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be defined in the environment.');
    }

    const existing = await usersService.findByEmail(adminEmail);
    if (existing) {
      logger.log(`Admin account already exists for ${adminEmail}`);
      return;
    }

    const createPayload: CreateUserDto = {
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    } as CreateUserDto;

    await usersService.createUser(createPayload);
    logger.log(`Admin account created for ${adminEmail}`);
  } catch (error) {
    logger.error('Failed to seed admin account', error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await appContext.close();
  }
}

bootstrap();
