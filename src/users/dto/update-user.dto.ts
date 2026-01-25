import { PartialType } from '@nestjs/swagger';
import { CreateAccountBaseDto } from './create-account-base.dto';

export class UpdateUserDto extends PartialType(CreateAccountBaseDto) {}
