import { Role } from '../../common/constants/roles.enum';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        gymId?: string;
        branchId?: string;
      };
      tenant?: {
        gymId?: string;
        branchId?: string;
      };
      id?: string; // Request correlation ID
    }
  }
}
