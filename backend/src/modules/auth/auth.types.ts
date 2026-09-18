import { Role } from '../user/user.types';

export interface RegisterUserInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  gymId?: string;
  branchId?: string;
}

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
}

export interface TokenRotationResult {
  accessToken: string;
  refreshToken: string;
}
