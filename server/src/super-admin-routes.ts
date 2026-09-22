// SkillsConnect Super Admin API — mounted at /api/platform/* in server.ts. Entirely separate from
// the company-scoped auth system: a Super Admin has no companyId and lives in a top-level
// platformAdmins collection, not any company's authAccounts subcollection (see the multi-tenant
// retrofit plan's Q4). Deliberately kept in its own file/router rather than growing the already
// very large server.ts further.
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { createPasswordCredentials, isStrongPassword, passwordPolicyMessage, verifyPassword } from './auth-utils.js';
import { createLmsRepository } from './repository.js';
import type { PasswordResetEmailService } from './email-service.js';
import {
  createCompanyRecord,
  createPlatformAdmin,
  createPlatformPasswordResetRequest,
  findPlatformAdminByEmail,
  getCompanyRecord,
  getCompanyUsage,
  getCompanyUserCount,
  getPlatformBranding,
  getPlatformPasswordResetTokenStatus,
  listCompanies,
  listPlatformAdmins,
  resetPlatformAdminPassword,
  updateCompanySlug,
  updateCompanySubscription,
  updatePlatformBranding,
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

const resetCompanyAdminPasswordSchema = z.object({
  password: z.string().min(1),
});

const updateCompanySlugSchema = z.object({
  slug: z.string().min(1),
});

const strongPasswordSchema = z.string().refine(isStrongPassword, { message: passwordPolicyMessage });

const createSuperAdminSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: strongPasswordSchema,
});

const platformPasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

const platformPasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});

// The one login screen's branding, shared by every company (see platform-repository.ts's
// getPlatformBranding/updatePlatformBranding) — the logo is a data: URI stored directly on the
// settings document rather than a Storage upload, since it's a single small, rarely-changed image
// with no per-company scoping to route it through; the length cap leaves generous headroom under
// Firestore's 1 MiB document limit once base64's ~4/3 overhead is accounted for. backgroundImageUrl
// is a real Storage URL instead (see POST /storage/upload-base64 below) — a full-page background
// picture is expected to be larger/more detailed than the small logo mark, so it's uploaded to
// Storage first rather than embedded, keeping this document small regardless of image size.
const platformBrandingUpdateSchema = z.object({
  themeId: z.enum(['ocean', 'forest', 'sunrise', 'purple', 'black', 'grey']),
  companyLogoDataUrl: z.string().max(1_000_000).regex(/^data:image\//, 'Logo must be an image file.').nullable(),
  backgroundImageUrl: z.string().url().nullable().optional(),
});

export function createSuperAdminRouter(options: {
  jwtSecret: string;
  jwtExpiresIn: jwt.SignOptions['expiresIn'];
  emailService: PasswordResetEmailService;
  resolveAppBaseUrl: (request?: express.Request) => string;
  storageBucket: string;
}): express.Router {
  const { jwtSecret, jwtExpiresIn, emailService, resolveAppBaseUrl, storageBucket } = options;
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

  // Platform-level counterpart of POST /api/auth/password-reset/request in server.ts — same
  // "always respond 202 with a generic message" shape to avoid confirming whether a given email
  // has a Super Admin account. No cross-company candidate loop needed here (unlike the company
  // flow): a Super Admin email is either registered once in platformAdmins, or not at all.
  router.post('/auth/password-reset/request', async (request, response, next) => {
    try {
      const payload = platformPasswordResetRequestSchema.parse(request.body);

      if (!emailService.isConfigured()) {
        response.status(503).json({ message: 'Password reset email is not configured on the server.' });
        return;
      }

      const resetRequest = await createPlatformPasswordResetRequest(payload.email);
      if (resetRequest) {
        const resetUrl = `${resolveAppBaseUrl(request)}/super-admin/reset-password?token=${encodeURIComponent(resetRequest.token)}`;
        await emailService.sendPasswordResetEmail({
          to: resetRequest.adminEmail,
          username: resetRequest.adminName,
          resetUrl,
          expiresAt: resetRequest.expiresAt,
        });
      }

      response.status(202).json({ message: 'If that email address belongs to a Super Admin account, a password reset link has been sent.' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/auth/password-reset/validate', async (request, response, next) => {
    try {
      const token = String(request.query['token'] || '');
      if (!token) {
        response.status(400).json({ valid: false, message: 'Reset token is required.' });
        return;
      }

      response.json(await getPlatformPasswordResetTokenStatus(token));
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/password-reset/confirm', async (request, response, next) => {
    try {
      const payload = platformPasswordResetConfirmSchema.parse(request.body);
      const result = await resetPlatformAdminPassword(payload.token, payload.password);

      if (!result) {
        response.status(400).json({ message: 'This password reset link is invalid or has expired.' });
        return;
      }

      response.json({ message: 'Password updated successfully.', name: result.name, email: result.email });
    } catch (error) {
      next(error);
    }
  });

  // Lists every OTHER Super Admin (excludes the caller) — used by the dashboard's "Manage Super
  // Admins" panel.
  router.get('/admins', requireSuperAdmin, async (request, response, next) => {
    try {
      const admins = await listPlatformAdmins();
      response.json(admins.filter((admin) => admin.id !== request.platformAuth!.adminId));
    } catch (error) {
      next(error);
    }
  });

  // Same "creator sets the initial password directly" shape as POST
  // /companies/:companyId/admins below — no invite-email flow for admin creation anywhere in
  // this codebase.
  router.post('/admins', requireSuperAdmin, async (request, response, next) => {
    try {
      const input = createSuperAdminSchema.parse(request.body);
      const result = await createPlatformAdmin(input);

      switch (result.status) {
        case 'email-taken':
          response.status(409).json({ message: 'A Super Admin account with this email already exists.' });
          return;
        case 'invalid':
          response.status(400).json({ message: 'Invalid name, email, or password.' });
          return;
      }

      response.status(201).json(result.admin);
    } catch (error) {
      next(error);
    }
  });

  router.get('/companies', requireSuperAdmin, async (_request, response, next) => {
    try {
      const companies = await listCompanies();
      // getCompanyUserCount rather than getCompanyUsage here — the latter would re-fetch each
      // company's own document, which listCompanies() already returned every field of.
      const withUsage: CompanyWithUsage[] = await Promise.all(
        companies.map(async (company) => ({
          ...company,
          usage: { userCount: await getCompanyUserCount(company.id), licenseLimit: company.subscription.licenseLimit },
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
      // A brand-new company always starts at 0 users — filled in directly rather than a
      // redundant getCompanyUsage() read, and required to match this route's own declared
      // response type, CompanyWithUsage (see the import above).
      const withUsage: CompanyWithUsage = { ...company, usage: { userCount: 0, licenseLimit: company.subscription.licenseLimit } };
      response.status(201).json(withUsage);
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
      const result = await repository.createAdministratorAccount(input, company.subscription.licenseLimit);

      switch (result.status) {
        case 'email-taken':
          response.status(409).json({ message: 'An account with this email already exists for this company.' });
          return;
        case 'license-limit-reached':
          response.status(409).json({ message: 'This company has reached its license limit — raise the limit before adding another user.' });
          return;
        case 'invalid-input':
          response.status(400).json({ message: 'Invalid email or password.' });
          return;
      }

      response.status(201).json({ id: result.account.id, email: result.account.email, role: result.account.role });
    } catch (error) {
      next(error);
    }
  });

  // Super Admin's "see this company's admins" list — used to populate the dashboard's Manage
  // Admins panel before offering the reset-password action below.
  router.get('/companies/:companyId/admins', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const company = await getCompanyRecord(companyId);
      if (!company) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      const repository = createLmsRepository(companyId);
      response.json(await repository.listAdministratorAccounts());
    } catch (error) {
      next(error);
    }
  });

  // Support action: set a company admin's password directly, no email/token round-trip — for
  // when an admin is locked out and can't complete the normal self-service reset (e.g. their
  // company has no SMTP configured, or they no longer have access to the email on file).
  router.put('/companies/:companyId/admins/:accountId/password', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const accountId = request.params['accountId'] as string;
      const input = resetCompanyAdminPasswordSchema.parse(request.body);

      const company = await getCompanyRecord(companyId);
      if (!company) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      const repository = createLmsRepository(companyId);
      const result = await repository.resetAdministratorPassword(accountId, input.password);

      switch (result.status) {
        case 'not-found':
          response.status(404).json({ message: 'That administrator account was not found for this company.' });
          return;
        case 'invalid-password':
          response.status(400).json({ message: 'Password does not meet the strength requirements.' });
          return;
      }

      response.json({ message: 'Password reset successfully.' });
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
      // Same reasoning as GET /companies above — avoid re-fetching each company's own document.
      const perCompany = await Promise.all(
        companies.map(async (company) => ({
          companyId: company.id,
          name: company.name,
          usage: { userCount: await getCompanyUserCount(company.id), licenseLimit: company.subscription.licenseLimit },
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

  // Mirrors server.ts's own POST /api/storage/upload-base64 (same Cloud-Functions-multipart
  // workaround, same JSON/base64-in-body approach) — a Super Admin token has no companyId of its
  // own to scope an upload path to, so this instead takes an OPTIONAL companyId in the body: when
  // editing one company's branding, the dashboard passes that company's id, scoping the Storage
  // path the exact same way that company's own admin-set logo already is
  // (lms-uploads/{companyId}/branding/...); when editing the platform-wide default, it's omitted
  // and the file goes under a shared platform-branding/ path instead. Used today for the login
  // background image only — the logo stays embedded as base64 (see platformBrandingUpdateSchema's
  // own comment for why that's still fine for a small logo but not for a full-page picture).
  const maxJsonUploadBytes = 8 * 1024 * 1024;
  router.post('/storage/upload-base64', requireSuperAdmin, async (request, response, next) => {
    try {
      if (!storageBucket) {
        response.status(503).json({ message: 'File storage is not configured on this server.' });
        return;
      }

      const { folder, fileName, contentType, dataBase64, companyId } = z.object({
        folder: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(64),
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(127),
        dataBase64: z.string().min(1),
        companyId: z.string().min(1).optional(),
      }).parse(request.body);

      if (!contentType.startsWith('image/')) {
        response.status(400).json({ message: 'Only image files are allowed.' });
        return;
      }

      const buffer = Buffer.from(dataBase64, 'base64');
      if (buffer.length > maxJsonUploadBytes) {
        response.status(413).json({ message: 'File is too large. Please upload a file under 8 MB.' });
        return;
      }

      if (companyId && !(await getCompanyRecord(companyId))) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      const ext = fileName.split('.').pop() ?? '';
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
      const filePath = companyId
        ? `lms-uploads/${companyId}/${folder}/${safeName}`
        : `platform-branding/${folder}/${safeName}`;

      const adminApp = getApps().length > 0 ? getApp() : initializeApp();
      const bucket = getStorage(adminApp).bucket(storageBucket);
      const storageFile = bucket.file(filePath);

      await storageFile.save(buffer, { contentType });
      await storageFile.makePublic();

      const publicUrl = `https://storage.googleapis.com/${storageBucket}/${filePath}`;
      response.json({ url: publicUrl, path: filePath });
    } catch (error) {
      next(error);
    }
  });

  // The one login screen's branding — GET is intentionally also gated to requireSuperAdmin (the
  // dashboard's own edit panel needs to read the current value before showing it), unlike
  // GET /api/branding in server.ts, which is the public, unauthenticated route every visitor's
  // login screen actually renders from.
  router.get('/branding', requireSuperAdmin, async (_request, response, next) => {
    try {
      response.json(await getPlatformBranding());
    } catch (error) {
      next(error);
    }
  });

  router.put('/branding', requireSuperAdmin, async (request, response, next) => {
    try {
      const payload = platformBrandingUpdateSchema.parse(request.body);
      // Unlike the per-company branding route below, this is the ONE caller of
      // updatePlatformBranding — always defaulted to a concrete value here (never left undefined)
      // since that function does a full replace, not a merge (see its own comment).
      response.json(await updatePlatformBranding({ ...payload, backgroundImageUrl: payload.backgroundImageUrl ?? null }));
    } catch (error) {
      next(error);
    }
  });

  // A specific company's own login-page branding — reuses the exact same per-company
  // BrandingSettingsRecord/repository.getBranding/updateBranding a company's own admin already
  // edits via PUT /api/branding, just targeting a company the Super Admin explicitly names
  // instead of resolving one from the caller's own JWT (see createLmsRepository(companyId) usage
  // elsewhere in this file for the identical pattern). Reuses platformBrandingUpdateSchema's
  // base64-data-URI shape (rather than server.ts's Storage-upload-backed one) since the Super
  // Admin dashboard reuses the same logo-upload UI already built for the platform-wide branding
  // above, not a Storage upload flow scoped to this target company.
  router.get('/companies/:companyId/branding', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const company = await getCompanyRecord(companyId);
      if (!company) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      const repository = createLmsRepository(companyId);
      response.json(await repository.getBranding());
    } catch (error) {
      next(error);
    }
  });

  router.put('/companies/:companyId/branding', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const company = await getCompanyRecord(companyId);
      if (!company) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }

      const payload = platformBrandingUpdateSchema.parse(request.body);
      const repository = createLmsRepository(companyId);
      response.json(await repository.updateBranding(payload));
    } catch (error) {
      next(error);
    }
  });

  // Sets/changes the URL slug this company's own branded login page is reached at
  // (.../login/{slug} — see GET /api/companies/:slug/branding, the public route in server.ts that
  // actually resolves it). Unset by default; a company has no custom login URL until a Super
  // Admin deliberately assigns one here.
  router.patch('/companies/:companyId/slug', requireSuperAdmin, async (request, response, next) => {
    try {
      const companyId = request.params['companyId'] as string;
      const { slug } = updateCompanySlugSchema.parse(request.body);
      const result = await updateCompanySlug(companyId, slug);

      switch (result.status) {
        case 'not-found':
          response.status(404).json({ message: 'Company not found.' });
          return;
        case 'invalid':
          response.status(400).json({ message: 'Slug must be lowercase letters, numbers and hyphens only (2-40 characters), and cannot start or end with a hyphen.' });
          return;
        case 'taken':
          response.status(409).json({ message: 'Another company already uses this login URL. Choose a different one.' });
          return;
      }

      response.json(result.company);
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
