import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user by email/username/phone' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('collectors')
  @ApiOperation({ summary: 'Create a collector account with optional profile' })
  createCollector(@Body() dto: CreateCollectorDto) {
    return this.authService.createCollectorAccount(dto);
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create a customer account with required customer details' })
  @ApiBody({ type: CreateCustomerDto })
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.authService.createCustomerAccount(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a password reset token via email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with a valid token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password using current password validation',
  })
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(dto);
  }

}
