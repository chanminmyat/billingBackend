import { CollectorProfile } from '../../collectors/entities/collector-profile.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  username?: string | null;
  role: UserRole;
  status: UserStatus;
  collectorProfile?: CollectorProfile | null;
  customer?: Customer | null;
  createdAt: Date;
  updatedAt: Date;
}
