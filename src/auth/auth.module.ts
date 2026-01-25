import { Module } from '@nestjs/common';
import { CollectorsModule } from '../collectors/collectors.module';
import { CustomersModule } from '../customers/customers.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule, CollectorsModule, CustomersModule, PasswordResetModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
