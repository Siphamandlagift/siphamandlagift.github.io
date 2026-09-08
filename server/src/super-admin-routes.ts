// SkillsConnect Super Admin API — mounted at /api/platform/* in server.ts. Entirely separate from
// the company-scoped auth system: a Super Admin has no companyId and lives in a top-level
// platformAdmins collection, not any company's authAccounts subcollection (see the multi-tenant
// retrofit plan's Q4). Deliberately kept in its own file/router rather than growing the already
// very large server.ts further.
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { createPasswordCredentials, isStrongPassword, passwordPolicyMessage, verifyPassword } from './auth-utils.js';
import { createLmsRepository } from './repository.js';
import {
  createCompanyRecord,
  findPlatformAdminByEmail,
  getCompanyRecord,
  getCompanyUsage,
  listCompanies,
  updateCompanySubscription,
} from './platform-repository.js';
import type { CompanyWithUsage, PlatformAdminRecord } from './contracts.js';

export type PlatformAuthenticatedIdentity = { adminId: string; email: string; name: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      platformAuth?: PlatformAuthenticatedIdentity;
    }
  }
}

const subscriptionPlanSchema = z.enum(['starter', 'growth', 'enterprise']);

const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createCompanySchema = z.object({
  name: z.string().min(1),
  plan: subscriptionPlanSchema,
  licenseLimit: z.number().int().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
}).refine((input) => new Date(input.endDate).getTime() > new Date(input.startDate).getTime(), {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

const updateSubscriptionSchema = z.object({
  plan: subscriptionPlanSchema.optional(),
  licenseLimit: z.number().int().positive().optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
}).refine((input) => Object.keys(input).length > 0, { message: 'At least one field must be provided.' });

const createCompanyAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function createSuperAdminRouter(options: { jwtSecret: string; jwtExpiresIn: jwt.SignOptions['expiresIn'] }): express.Router {
  const { jwtSecret, jwtExpiresIn } = options;
  const router = express.Router();

  function requireSuperAdmin(request: express.Request, response: express.Response, next: express.NextFunction) {
    const authHeader = request.headers['authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      response.status(401).json({ message: 'Authentication required. Please log in.' });
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (typeof decoded !== 'object' || decoded === null || (decoded as { scope?: unknown }).scope !== 'platform') {
        response.status(403).json({ message: 'You do not have permission to perform this action.' });
        return;
      }

      const payload = decoded as { adminId?: unknown; email?: unknown; name?: unknown };
      request.platformAuth = {
        adminId: typeof payload.adminId === 'string' ? payload.adminId : '',
        email: typeof payload.email === 'string' ? payload.email : '',
        name: typeof payload.name === 'string' ? payload.name : '',
      };
      next();
    } catch {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
    }
  }

  router.post('/auth/login', async (request, response, next) => {
    try {
      const credentials = platformLoginSchema.parse(request.body);
      const admin: PlatformAdminRecord | null = await findPlatformAdminByEmail(credentials.email);

      if (!admin || !verifyPassword(credentials.password, admin.passwordSalt, admin.passwordHash)) {
        response.status(401).json({ message: 'Invalid login credentials.' });
        return;
      }

      const token = jwt.sign(
        { scope: 'platform', adminId: admin.id, email: admin.email, name: admin.name },
        jwtSecret,
        { expiresIn: jwtExpiresIn },
      );

      response.json({ adminId: admin.id, name: admin.name, email: admin.email, token });
    } catch (error) {
      next(error);
    }
  });

  router.get('/companies', requireSuperAdmin, async (_request, response, next) => {
    try {
      const companies = await listCompanies();
      const withUsage: CompanyWithUsage[] = await Promise.all(
        companies.map(async (company) => ({
          ...company,
          usage: (await getCompanyUsage(company.id)) ?? { userCount: 0, licenseLimit: company.subscription.licenseLimit },
        })),
      );
      response.json(withUsage);
    } catch (error) {
      next(error);
    }
  });

  router.post('/companies', requireSuperAdmin, async (request, response, next) => {
    try {
      const input = createCompanySchema.parse(request.body);
      const company = await createCompanyRecord(input, request.platformAuth!.adminId);
      response.status(201).json(company);
    } catch (error) {
      next(error);
    }
  });

  router.get('/companies/:companyId', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const company = await getCompanyRecord(companyId);
      if (!company) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      const usage = (await getCompanyUsage(companyId)) ?? { userCount: 0, licenseLimit: company.subscription.licenseLimit };
      const withUsage: CompanyWithUsage = { ...company, usage };
      response.json(withUsage);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/companies/:companyId/subscription', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const patch = updateSubscriptionSchema.parse(request.body);
      const updated = await updateCompanySubscription(companyId, patch);

      if (!updated) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post('/companies/:companyId/admins', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const input = createCompanyAdminSchema.parse(request.body);

      if (!isStrongPassword(input.password)) {
        response.status(400).json({ message: 'Password does not meet the strength requirements.' });
        return;
      }

      const company = await getCompanyRecord(companyId);
      if (!company) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      const repository = createLmsRepository(companyId);
      const account = await repository.createAdministratorAccount(input, company.subscription.licenseLimit);

      if (!account) {
        response.status(409).json({ message: 'Could not create this administrator account — the email may already be in use, or this company has reached its license limit.' });
        return;
      }

      response.status(201).json({ id: account.id, email: account.email, role: account.role });
    } catch (error) {
      next(error);
    }
  });

  router.get('/companies/:companyId/usage', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const usage = await getCompanyUsage(companyId);
      if (!usage) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      response.json(usage);
    } catch (error) {
      next(error);
    }
  });

  router.get('/usage', requireSuperAdmin, async (_request, response, next) => {
    try {
      const companies = await listCompanies();
      const perCompany = await Promise.all(
        companies.map(async (company) => ({
          companyId: company.id,
          name: company.name,
          usage: (await getCompanyUsage(company.id)) ?? { userCount: 0, licenseLimit: company.subscription.licenseLimit },
          status: company.subscription.status,
        })),
      );

      response.json({
        companyCount: companies.length,
        totalUsers: perCompany.reduce((total, entry) => total + entry.usage.userCount, 0),
        companies: perCompany,
      });
    } catch (error) {
      next(error);
    }
  });

  // Unauthenticated JSON payload errors (e.g. createCompanySchema.parse failing) fall through to
  // this router's own handler chain and on to server.ts's shared error middleware via next(error)
  // in every handler above — nothing else to wire here.

  return router;
}

// Used by the standalone seed-super-admin.ts script (and its temporary HTTP-route equivalent, if
// one is needed the same way the Phase 2 migration used one — see that script's header comment)
// to construct the first PlatformAdminRecord. Kept here rather than in that script so the
// password-hashing convention stays in one place.
export function buildPlatformAdminRecord(input: { id: string; name: string; email: string; password: string }): PlatformAdminRecord {
  if (!isStrongPassword(input.password)) {
    throw new Error(`Password does not meet the strength requirements: ${passwordPolicyMessage}`);
  }

  const credentials = createPasswordCredentials(input.password);
  return {
    id: input.id,
    role: 'super-admin',
    name: input.name,
    email: input.email,
    emailLower: input.email.trim().toLowerCase(),
    passwordHash: credentials.passwordHash,
    passwordSalt: credentials.passwordSalt,
  };
}
