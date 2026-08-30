import { Request as ExpressRequest } from 'express';
import { User, Employee } from '@prisma/client';

export interface AuthenticatedUser extends Omit<User, 'password'> {
  employee?: Employee | null;
  permissions?: string[];
}

export interface AuthenticatedRequest extends ExpressRequest {
  user: AuthenticatedUser;
}
