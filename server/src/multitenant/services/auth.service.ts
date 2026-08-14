import type { MultiTenantConfig } from '../config.js';
import { AppError } from '../errors.js';
import { signAuthToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';
import { permissionsForRole } from '../rbac.js';
import type { AuthResponse, AuthenticatedUserProfile } from '../types.js';
import type { LoginRequest, RegisterRequest } from '../schemas/auth.schemas.js';

export class AuthService {
  constructor(
    private readonly repository: MultiTenantRepository,
    private readonly config: MultiTenantConfig,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResponse> {
    const passwordHash = await hashPassword(input.password, this.config.bcryptSaltRounds);
    const user = await this.repository.registerTenant({
      companyName: input.companyName,
      licenseType: input.licenseType,
      name: input.name,
      email: input.email,
      passwordHash,
    });

    return this.createAuthResponse(user);
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.repository.findUserByEmail(input.email);

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new AppError('Invalid email or password.', 401);
    }

    return this.createAuthResponse({
      userId: user.id,
      companyId: user.companyId,
      companyName: user.companyName,
      licenseType: user.licenseType,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: permissionsForRole(user.role),
      isPlatformAdmin: user.isPlatformAdmin,
    });
  }

  private createAuthResponse(user: AuthenticatedUserProfile): AuthResponse {
    return {
      token: signAuthToken({
        userId: user.userId,
        companyId: user.companyId,
        email: user.email,
        role: user.role,
        name: user.name,
        isPlatformAdmin: user.isPlatformAdmin,
      }, this.config),
      user,
    };
  }
}