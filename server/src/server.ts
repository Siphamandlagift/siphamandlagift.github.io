import 'dotenv/config';
// ...existing code...
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { unzipSync } from 'fflate';
import { z } from 'zod';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { createDefaultData } from './default-data.js';
import { createLmsRepository } from './repository.js';
import { PasswordResetEmailService } from './email-service.js';
import { isStrongPassword, passwordPolicyMessage } from './auth-utils.js';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Prefer an explicitly configured app URL, but fall back to request origin
// so hosted deployments behind Firebase rewrites do not produce localhost links.
const configuredAppBaseUrl = process.env['LMS_APP_BASE_URL']?.trim();
const appBaseUrl = configuredAppBaseUrl?.replace(/\/$/, '') || 'http://localhost:4200';
const isHostedRuntime = Boolean(process.env['K_SERVICE'] || process.env['FUNCTION_TARGET'] || process.env['FUNCTION_NAME']);

function resolveAppBaseUrl(request?: express.Request): string {
  if (configuredAppBaseUrl) {
    return appBaseUrl;
  }

  if (!request) {
    return appBaseUrl;
  }

  const forwardedProtoHeader = request.headers['x-forwarded-proto'];
  const forwardedHostHeader = request.headers['x-forwarded-host'];
  const forwardedProto = typeof forwardedProtoHeader === 'string'
    ? forwardedProtoHeader.split(',')[0]?.trim()
    : undefined;
  const forwardedHost = typeof forwardedHostHeader === 'string'
    ? forwardedHostHeader.split(',')[0]?.trim()
    : undefined;

  const protocol = forwardedProto || request.protocol;
  const host = forwardedHost || request.get('host');

  if (!host) {
    return appBaseUrl;
  }

  return `${protocol}://${host}`.replace(/\/$/, '');
}
const defaultAllowedOrigins = isHostedRuntime
  ? 'https://skillsconnect-f2275.web.app,https://skillsconnect-f2275.firebaseapp.com,https://skillsconnect-sa.co.za'
  : 'http://localhost:4200,https://skillsconnect-f2275.web.app,https://skillsconnect-f2275.firebaseapp.com,https://skillsconnect-sa.co.za';

const allowedOrigins = new Set(
  (process.env['LMS_ALLOWED_ORIGINS'] || defaultAllowedOrigins)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const corsOptions: cors.CorsOptions = {
  origin(requestOrigin, callback) {
    // Allow server-to-server requests (no Origin header) and listed browser origins.
    if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin '${requestOrigin}' is not allowed.`));
    }
  },
  credentials: false,
};

export const app = express();
app.use(helmet());
const repository = createLmsRepository();
const emailService = new PasswordResetEmailService();
const port = Number(process.env['PORT'] || process.env['LMS_API_PORT'] || 3000);
const jwtSecret = requireEnv('LMS_JWT_SECRET');
const jwtExpiresIn = '12h';

// Routes that do not require a JWT token.
const publicPaths = new Set([
  '/health',
  '/api/health',
  '/api/branding',
  '/api/auth/login',
  '/api/auth/resolve-roles',
  '/api/auth/sso/microsoft/start',
  '/api/auth/sso/microsoft/callback',
  '/api/auth/password-reset/request',
  '/api/auth/password-reset/validate',
  '/api/auth/password-reset/confirm',
]);

function requireAuth(request: express.Request, response: express.Response, next: express.NextFunction) {
  // Publicly readable uploaded files do not require auth.
  if (publicPaths.has(request.path) || request.path.startsWith('/api/files/') || request.path.startsWith('/api/storage/scorm')) {
    next();
    return;
  }
  const authHeader = request.headers['authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  if (!token) {
    response.status(401).json({ message: 'Authentication required. Please log in.' });
    return;
  }
  try {
    jwt.verify(token, jwtSecret);
    next();
  } catch {
    response.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}

type AuthenticatedIdentity = { role: string; username: string; email: string; studentId: string | null };

// requireAuth only proves the caller has SOME valid session — it never checks role or ownership.
// Route handlers that touch another user's data or a manager/admin-only action must call this
// themselves and check the result; do not assume being logged in is enough authorization.
function getAuthenticatedIdentity(request: express.Request): AuthenticatedIdentity | null {
  const authHeader = request.headers['authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded !== 'object' || decoded === null) {
      return null;
    }

    const payload = decoded as { role?: unknown; username?: unknown; email?: unknown; studentId?: unknown };
    return {
      role: typeof payload.role === 'string' ? payload.role : '',
      username: typeof payload.username === 'string' ? payload.username : '',
      email: typeof payload.email === 'string' ? payload.email : '',
      // Tokens issued before this claim existed won't have it — callers that check student
      // ownership must fall back to another signal (e.g. matching email) when this is null.
      studentId: typeof payload.studentId === 'string' && payload.studentId ? payload.studentId : null,
    };
  } catch {
    return null;
  }
}

function requireRole(...allowedRoles: string[]) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const identity = getAuthenticatedIdentity(request);

    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    if (!allowedRoles.includes(identity.role)) {
      response.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }

    next();
  };
}

const requireAdministrator = requireRole('administrator');
const requireManagerOrAdministrator = requireRole('administrator', 'training-manager');

async function isOwnStudentRecord(studentId: string, identity: AuthenticatedIdentity): Promise<boolean> {
  // Prefer the studentId claim: it's the session's actual linked student record, set at login.
  if (identity.studentId === studentId) {
    return true;
  }

  // Falls back to an email match against the roster whenever the claim doesn't directly match —
  // both when there's no claim at all (tokens issued before this claim existed), and when the
  // claim itself has simply gone stale (e.g. an admin recreated this student's roster entry,
  // under a new id, sometime after the session was issued). Without this fallback, a stale claim
  // would make the server reject a student's own legitimate write to their current, correct
  // record purely because it doesn't match an outdated id still sitting in their token — the
  // client resolves the same way (see matchedKpiStudentId in student-profile.component.ts), so
  // this keeps the two in agreement instead of one trusting the claim and the other not. Safe the
  // same way the old "claim absent" fallback already was: identity.email comes from the verified
  // JWT, not from caller input, so this can't be used to write to an unrelated student's record.
  const data = await repository.read();
  const student = data.students.find((entry) => entry.id === studentId);
  return Boolean(student && student.email.trim().toLowerCase() === identity.email.trim().toLowerCase());
}

function readAuthenticatedSessionPayload(request: express.Request) {
  const authHeader = request.headers['authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return null;
  }

  const decoded = jwt.verify(token, jwtSecret);
  if (typeof decoded !== 'object' || decoded === null) {
    return null;
  }

  return {
    role: typeof decoded['role'] === 'string' ? decoded['role'] : '',
    username: typeof decoded['username'] === 'string' ? decoded['username'] : '',
    email: typeof decoded['email'] === 'string' ? decoded['email'] : '',
  };
}

function fallbackSwitchableRolesForRole(role: string): Array<'administrator' | 'training-manager' | 'student'> {
  if (role === 'administrator') {
    return ['training-manager', 'student'];
  }

  if (role === 'training-manager') {
    return ['student'];
  }

  return [];
}

function routeForTargetRole(targetRole: 'administrator' | 'training-manager' | 'student') {
  switch (targetRole) {
    case 'administrator':
      return '/admin-profile';
    case 'training-manager':
      return '/training-manager-profile';
    default:
      return '/student-profile';
  }
}

function fallbackRoleResolution(
  payload: { role: string; username: string; email: string },
  targetRole: 'administrator' | 'training-manager' | 'student',
) {
  const allowedTargets = fallbackSwitchableRolesForRole(payload.role);
  if (!allowedTargets.includes(targetRole)) {
    return null;
  }

  return {
    role: targetRole,
    route: routeForTargetRole(targetRole),
    username: payload.username,
    email: payload.email,
    studentId: undefined,
  };
}


const trainingAssessmentChoiceSchema = z.object({
  text: z.string(),
  points: z.number(),
  isCorrect: z.boolean(),
});

const trainingMatchingPairSchema = z.object({
  prompt: z.string(),
  answer: z.string(),
});

const trainingAssessmentQuestionSchema = z.object({
  prompt: z.string(),
  questionType: z.enum(['Multiple Choice', 'Short Answer', 'Long Answer', 'Document Upload', 'True or False', 'Matching']),
  points: z.number(),
  choices: z.array(trainingAssessmentChoiceSchema),
  matchingPairs: z.array(trainingMatchingPairSchema),
  dragAndDropEnabled: z.boolean(),
  attachmentFileName: z.string(),
  attachmentDataUrl: z.string().optional(),
});

const trainingContentItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['Video', 'Assessment', 'Document', 'Scorm']),
  title: z.string().min(1),
  assessmentType: z.enum(['Quiz', 'Assignment', 'Mentorship', 'Read and Acknowledge']).nullable(),
  passMarkPercentage: z.number().int().min(1).max(100).optional(),
  maxAttempts: z.number().int().min(1).optional(),
  resourceLink: z.string(),
  uploadedFileName: z.string(),
  uploadedFileDataUrl: z.string().optional(),
  convertedPdfUrl: z.string().optional(),
  requiresAcknowledgement: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  durationSeconds: z.number().min(0).optional(),
  questions: z.array(trainingAssessmentQuestionSchema),
});

const trainingOfferingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['Course', 'Programme']),
  category: z.string().min(1),
  description: z.string().min(1),
  completionDeadline: z.string(),
  thumbnailDataUrl: z.string().nullable(),
  contentItems: z.array(trainingContentItemSchema),
  createdOn: z.string().min(1),
  status: z.enum(['Published', 'Draft']),
});

const trainingOfferingUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['Course', 'Programme']),
  category: z.string().min(1),
  description: z.string().min(1),
  completionDeadline: z.string(),
  status: z.enum(['Published', 'Draft']),
  thumbnailDataUrl: z.string().nullable(),
  contentItems: z.array(trainingContentItemSchema).optional(),
});

const assignmentSubmissionSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  studentEmail: z.string().min(1),
  courseId: z.string().min(1).optional(),
  offeringId: z.string().min(1),
  offeringTitle: z.string().min(1),
  assessmentId: z.string().min(1).optional(),
  assessmentStepId: z.string().min(1).optional(),
  assessmentTitle: z.string().min(1),
  questionType: z.enum(['Short Answer', 'Long Answer', 'Document Upload']),
  responseText: z.string(),
  documentFileName: z.string(),
  documentDataUrl: z.string(),
  possiblePoints: z.number(),
  attemptsUsed: z.number().int().min(1).optional(),
  awardedPoints: z.number().nullable(),
  submittedAt: z.string().min(1),
  status: z.enum(['Pending Review', 'Approved', 'Needs Revision']),
  reviewerName: z.string().nullable(),
  reviewerFeedback: z.string(),
  reviewedAt: z.string().nullable(),
});

const managerMessageReplySchema = z.object({
  id: z.string().min(1),
  sender: z.string().min(1),
  body: z.string(),
  time: z.string().min(1),
  authorType: z.enum(['manager', 'contact']),
  deliveryState: z.enum(['Sent', 'Delivered']).optional(),
});

const managerMessageSchema = z.object({
  id: z.string().min(1),
  sender: z.string().min(1),
  subject: z.string().min(1),
  preview: z.string(),
  body: z.string(),
  time: z.string().min(1),
  unread: z.boolean(),
  replies: z.array(managerMessageReplySchema),
});


const systemTrainingManagerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  team: z.string(),
  email: z.string(),
});

const externalTrainingRequestSchema = z.object({
  id: z.string(),
  studentId: z.string().optional().default(''),
  studentName: z.string(),
  studentEmail: z.string(),
  courseName: z.string(),
  provider: z.string(),
  trainingType: z.enum(['Accredited', 'Workshop/Seminar', 'Informal Training', 'Short Course']),
  alignedToIdp: z.enum(['Yes', 'No']),
  trainingStartDate: z.string(),
  trainingEndDate: z.string(),
  courseCost: z.string(),
  additionalCostRequired: z.enum(['Yes', 'No']),
  travelCost: z.string(),
  examCost: z.string(),
  accommodationCost: z.string(),
  approvingManagerId: z.string(),
  approvingManagerName: z.string(),
  approvingManagerEmail: z.string(),
  invoiceFileName: z.string(),
  invoiceDataUrl: z.string(),
  brochureFileName: z.string(),
  brochureDataUrl: z.string(),
  proofOfPaymentFileName: z.string().optional().default(''),
  proofOfPaymentUrl: z.string().optional().default(''),
  certificateFileName: z.string().optional().default(''),
  certificateUrl: z.string().optional().default(''),
  status: z.enum(['Pending Review', 'Approved', 'Needs Revision']),
  submittedAt: z.string(),
  reviewerName: z.string().nullable(),
  reviewerFeedback: z.string(),
  reviewedAt: z.string().nullable(),
});

const externalTrainingRequestInputSchema = z.object({
  studentId: z.string().optional().default(''),
  studentName: z.string().min(1),
  studentEmail: z.string().min(1),
  courseName: z.string().min(1),
  provider: z.string().min(1),
  trainingType: z.enum(['Accredited', 'Workshop/Seminar', 'Informal Training', 'Short Course']),
  alignedToIdp: z.enum(['Yes', 'No']),
  trainingStartDate: z.string().min(1),
  trainingEndDate: z.string().min(1),
  courseCost: z.string().min(1),
  additionalCostRequired: z.enum(['Yes', 'No']),
  travelCost: z.string(),
  examCost: z.string(),
  accommodationCost: z.string(),
  approvingManagerId: z.string().min(1),
  invoiceFileName: z.string(),
  invoiceDataUrl: z.string(),
  brochureFileName: z.string(),
  brochureDataUrl: z.string(),
});

const externalTrainingRequestCreateSchema = externalTrainingRequestInputSchema.superRefine((value, context) => {
  if (value.additionalCostRequired === 'Yes') {
    if (!value.travelCost.trim()) {
      context.addIssue({ code: 'custom', message: 'Travel cost is required when additional costs are requested.', path: ['travelCost'] });
    }

    if (!value.examCost.trim()) {
      context.addIssue({ code: 'custom', message: 'Exam cost is required when additional costs are requested.', path: ['examCost'] });
    }

    if (!value.accommodationCost.trim()) {
      context.addIssue({ code: 'custom', message: 'Accommodation cost is required when additional costs are requested.', path: ['accommodationCost'] });
    }
  }
});

const externalTrainingRequestUpdateSchema = externalTrainingRequestInputSchema.extend({
  requestId: z.string().min(1),
}).superRefine((value, context) => {
  if (value.additionalCostRequired === 'Yes') {
    if (!value.travelCost.trim()) {
      context.addIssue({ code: 'custom', message: 'Travel cost is required when additional costs are requested.', path: ['travelCost'] });
    }

    if (!value.examCost.trim()) {
      context.addIssue({ code: 'custom', message: 'Exam cost is required when additional costs are requested.', path: ['examCost'] });
    }

    if (!value.accommodationCost.trim()) {
      context.addIssue({ code: 'custom', message: 'Accommodation cost is required when additional costs are requested.', path: ['accommodationCost'] });
    }
  }
});

const externalTrainingRequestReviewSchema = z.object({
  requestId: z.string().min(1),
  reviewerName: z.string().min(1),
  status: z.enum(['Pending Review', 'Approved', 'Needs Revision']),
  feedback: z.string().optional(),
});

const externalTrainingRequestDocumentsSchema = z.object({
  requestId: z.string().min(1),
  invoiceFileName: z.string().optional(),
  invoiceDataUrl: z.string().optional(),
  proofOfPaymentFileName: z.string().optional(),
  proofOfPaymentUrl: z.string().optional(),
  certificateFileName: z.string().optional(),
  certificateUrl: z.string().optional(),
});
const mentorshipAssignmentSchema = z.object({
  id: z.string().min(1),
  menteeId: z.string().min(1),
  menteeName: z.string().min(1),
  menteeSurname: z.string().min(1),
  mentorshipStartDate: z.string().min(1),
  jobTitle: z.string(),
  mentorName: z.string(),
  mentorSurname: z.string(),
});

const mentorshipSubmissionSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  studentEmail: z.string().min(1),
  courseId: z.string().min(1).optional(),
  offeringId: z.string().min(1),
  offeringTitle: z.string().min(1),
  assessmentId: z.string().min(1).optional(),
  assessmentStepId: z.string().min(1).optional(),
  assessmentTitle: z.string().min(1),
  mentorName: z.string().min(1),
  sessionDate: z.string().min(1),
  actionPlan: z.string().min(1),
  attemptsUsed: z.number().int().positive().optional(),
  submittedAt: z.string().min(1),
  status: z.enum(['Pending Review', 'Approved', 'Needs Revision']),
  reviewerName: z.string().nullable(),
  reviewerFeedback: z.string(),
  reviewedAt: z.string().nullable(),
});

const quizSubmissionMatchingResponseSchema = z.object({
  prompt: z.string().min(1),
  answer: z.string(),
});

const quizSubmissionAnswerSchema = z.object({
  questionId: z.string().min(1),
  prompt: z.string().min(1),
  questionType: z.string().min(1),
  responseText: z.string(),
  selectedOption: z.string(),
  matchingResponses: z.array(quizSubmissionMatchingResponseSchema),
});

const quizSubmissionSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  studentEmail: z.string().min(1),
  courseId: z.string().min(1),
  courseTitle: z.string().min(1),
  assessmentId: z.string().min(1),
  assessmentTitle: z.string().min(1),
  answers: z.array(quizSubmissionAnswerSchema).min(1),
  attemptsUsed: z.number().int().min(1),
  passed: z.boolean(),
  scorePercentage: z.number(),
  scoreEarned: z.number(),
  scorePossible: z.number(),
  submittedAt: z.string().min(1),
});

const enrollmentStudentRoleSchema = z.enum(['student', 'manager', 'training-manager'])
  .transform((role) => role === 'training-manager' ? 'manager' as const : role);

const enrollmentStudentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  surname: z.string().min(1),
  group: z.string().min(1),
  dateEnrolled: z.string().min(1),
  deadlineDate: z.string().min(1),
  email: z.string().min(1),
  jobTitle: z.string(),
  idNumber: z.string(),
  activeStatus: z.enum(['Active', 'Inactive']),
  department: z.string().min(1),
  lineManager: z.string(),
  lineManagerId: z.string().optional(),
  status: z.enum(['Completed', 'In Progress', 'Not Yet Started']),
  assignedOfferingIds: z.array(z.string()),
  role: enrollmentStudentRoleSchema,
  isAdmin: z.boolean().optional().default(false),
  ofoCode: z.string().optional(),
  race: z.string().optional(),
  gender: z.string().optional(),
  municipality: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nqfLevel: z.string().optional(),
});

const studentMessageReplySchema = z.object({
  id: z.string().min(1),
  sender: z.string().min(1),
  body: z.string(),
  time: z.string().min(1),
  authorType: z.enum(['student', 'contact']),
  deliveryState: z.enum(['Sent', 'Delivered']).optional(),
});

const studentMessageSchema = z.object({
  id: z.string().min(1),
  sender: z.string().min(1),
  subject: z.string().min(1),
  preview: z.string(),
  body: z.string(),
  time: z.string().min(1),
  unread: z.boolean(),
  replies: z.array(studentMessageReplySchema),
});

const studentNotificationSchema = z.object({
  id: z.string().min(1),
  badge: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  dateLabel: z.string().min(1),
  unread: z.boolean(),
});

const studentCourseSchema = z.object({
  offeringId: z.string().optional(),
  name: z.string().min(1),
  progress: z.number().optional(),
  image: z.string().min(1),
  completed: z.boolean(),
  completedAt: z.string().optional(),
  description: z.string().min(1),
});

const studentProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  idNumber: z.string(),
  age: z.number().min(1),
  contactNumber: z.string().min(1),
  address: z.string().min(1),
  department: z.string(),
  jobTitle: z.string(),
  joined: z.string().min(1),
  learningStreak: z.string().min(1),
  profileImageDataUrl: z.string().nullable(),
  profileImageUrl: z.string().nullable().optional().default(null),
  passwordUpdatedAt: z.string().min(1),
});

const mentorshipObjectiveEntrySchema = z.object({
  title: z.string(),
  date: z.string(),
  achievementDate: z.string(),
});

const mentorshipProgressEntrySchema = z.object({
  objectiveAchieved: z.string(),
  dateAchieved: z.string(),
});

const studentMentorshipProfileSchema = z.object({
  menteeName: z.string(),
  menteeSurname: z.string(),
  menteeJobTitle: z.string(),
  menteeQualification: z.string(),
  menteeExperience: z.string(),
  mentorName: z.string(),
  mentorSurname: z.string(),
  mentorJobTitle: z.string(),
  mentorQualification: z.string(),
  mentorExperience: z.string(),
});

const studentMentorshipObjectivesSchema = z.object({
  mentorshipGoals: z.array(mentorshipObjectiveEntrySchema),
  objectives: z.array(mentorshipObjectiveEntrySchema),
});

const studentMentorshipProgressReportSchema = z.object({
  dateOfMeeting: z.string(),
  objectivesAchieved: z.array(mentorshipProgressEntrySchema),
  mentorComments: z.string(),
});

const studentBadgeStateSchema = z.object({
  earnedBadgeIds: z.array(z.string()),
});

const studentCertificateLicenceSchema = z.object({
  id: z.string().min(1),
  certificationName: z.string().min(1),
  completionDate: z.string(),
  expiryDate: z.string(),
  fileName: z.string(),
  fileDataUrl: z.string(),
  fileUrl: z.string().nullable().optional(),
  source: z.enum(['manual', 'course-completion']).optional(),
  status: z.enum(['Active', 'Expired', 'Pending Renewal']),
  renewalRequired: z.enum(['Yes', 'No']),
  reminderNotification: z.enum(['Yes', 'No']),
  reminderDaysBeforeExpiry: z.number().int().min(0),
});

const studentAssessmentAttemptSchema = z.object({
  attemptsUsed: z.number().int().min(1),
  passed: z.boolean(),
  lastScorePercentage: z.number().min(0).max(100),
  lastScoreEarned: z.number().min(0),
  lastScorePossible: z.number().min(0),
  lastSubmittedAt: z.string().min(1),
});

const studentIdpEntrySchema = z.object({
  developmentNeed: z.string(),
  plannedAction: z.string(),
  supportRequired: z.string(),
  dateCaptured: z.string(),
  targetDate: z.string(),
  status: z.enum(['Not Started', 'In Progress', 'Completed', 'On Hold']),
});

const studentKpiScoreSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable();

const studentKpiEntrySchema = z.object({
  id: z.string().min(1),
  keyResultArea: z.string(),
  kpi: z.string(),
  weight: z.number(),
  target: z.string(),
  actual: z.string(),
  comments: z.string(),
  overallScoring: studentKpiScoreSchema,
  // No longer independently editable in the manager's form (see the Final Rating column) — sent
  // through as hidden fields carrying forward whatever's already stored so this full-table save
  // can't blank them out. Kept required (not .default('')/nullable-optional) because the client
  // always includes them now, unlike gapInitiative/etc. below which it genuinely omits.
  managerScoring: studentKpiScoreSchema,
  employeeScoring: studentKpiScoreSchema,
  measure: z.string(),
  dateOfReview: z.string(),
  // The manager's full-table save form never carries these — they're written independently
  // through the gap-analysis endpoint below and forced back to whatever's already stored by
  // preserveEmployeeScoringOnFullReplace regardless of what's sent here (see repository.ts), the
  // same way employeeScoring is. .default('') just keeps a client that omits them entirely (as
  // this one does) from failing schema validation.
  gapInitiative: z.string().default(''),
  gapComments: z.string().default(''),
  gapTargetDate: z.string().default(''),
});

const kpiEntriesReplaceSchema = z.object({
  entries: z.array(studentKpiEntrySchema),
});

const kpiEmployeeScoringUpdateSchema = z.object({
  entries: z.array(z.object({
    id: z.string().min(1),
    employeeScoring: studentKpiScoreSchema,
  })),
});

const kpiGapAnalysisUpdateSchema = z.object({
  entries: z.array(z.object({
    id: z.string().min(1),
    gapInitiative: z.string(),
    gapComments: z.string(),
    gapTargetDate: z.string(),
  })),
});

const openKpiYearSchema = z.object({
  year: z.number().int(),
});

const studentNotificationPreferencesSchema = z.object({
  emailUpdates: z.boolean(),
  smsAlerts: z.boolean(),
  assignmentReminders: z.boolean(),
  messageNotifications: z.boolean(),
  certificateMilestones: z.boolean(),
});

const studentPrivacySettingsSchema = z.object({
  tutorProfileVisibility: z.boolean(),
  classmateProfileVisibility: z.boolean(),
  showEmailAddress: z.boolean(),
  showContactNumber: z.boolean(),
});

const studentSettingsSchema = z.object({
  notificationPreferences: studentNotificationPreferencesSchema,
  privacySettings: studentPrivacySettingsSchema,
  themePreference: z.enum(['ocean', 'forest', 'sunrise', 'purple', 'black', 'grey']).nullable(),
});

const brandingSettingsSchema = z.object({
  themeId: z.enum(['ocean', 'forest', 'sunrise', 'purple', 'black', 'grey']),
  companyLogoDataUrl: z.string().nullable(),
});

const studentSnapshotUpdateSchema = z.object({
  profile: studentProfileSchema,
  badgeState: studentBadgeStateSchema,
  certificatesAndLicences: z.array(studentCertificateLicenceSchema).optional().default([]),
  settings: studentSettingsSchema,
  mentorshipProfile: studentMentorshipProfileSchema,
  mentorshipObjectives: studentMentorshipObjectivesSchema,
  mentorshipProgressReport: studentMentorshipProgressReportSchema,
  courses: z.array(studentCourseSchema),
  notifications: z.array(studentNotificationSchema),
  messages: z.array(studentMessageSchema),
  notifiedOfferingIds: z.array(z.string()),
  assessmentAttempts: z.record(z.string(), studentAssessmentAttemptSchema),
  idpEntries: z.array(studentIdpEntrySchema).optional(),
});

const managerStatePatchSchema = z.object({
  students: z.array(enrollmentStudentSchema).optional(),
  trainingManagers: z.array(systemTrainingManagerSchema).optional(),
  managerMessages: z.array(managerMessageSchema).optional(),
  mentorshipAssignments: z.array(mentorshipAssignmentSchema).optional(),
  mentorshipSubmissions: z.array(mentorshipSubmissionSchema).optional(),
  externalTrainingRequests: z.array(externalTrainingRequestSchema).optional(),
});

const loginRequestSchema = z.object({
  role: z.enum(['administrator', 'training-manager', 'student']),
  username: z.string().min(1),
  password: z.string().min(1),
});

const resolveRolesRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const switchRoleRequestSchema = z.object({
  targetRole: z.enum(['administrator', 'training-manager', 'student']),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const strongPasswordSchema = z.string().refine(isStrongPassword, {
  message: passwordPolicyMessage,
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: strongPasswordSchema,
});

const changePasswordSchema = z.object({
  email: z.string().email(),
  password: strongPasswordSchema,
});

const managedUserCredentialSchema = z.object({
  studentId: z.string().min(1),
  email: z.string().email(),
  role: enrollmentStudentRoleSchema,
  password: strongPasswordSchema,
});

const managedUserCredentialsUpsertSchema = z.object({
  users: z.array(managedUserCredentialSchema),
});

const ssoRoleSchema = z.enum(['administrator', 'training-manager', 'student']);
const microsoftSsoStartQuerySchema = z.object({
  role: ssoRoleSchema.optional(),
});

type SsoRole = z.infer<typeof ssoRoleSchema>;

type MicrosoftSsoState = {
  nonce: string;
  role?: SsoRole;
  appBaseUrl: string;
};

type MicrosoftSsoConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  allowedEmailDomains: Set<string>;
};

function resolveMicrosoftSsoConfig(request: express.Request): MicrosoftSsoConfig | null {
  const clientId = process.env['LMS_SSO_MICROSOFT_CLIENT_ID']?.trim();
  const clientSecret = process.env['LMS_SSO_MICROSOFT_CLIENT_SECRET']?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  const tenantId = process.env['LMS_SSO_MICROSOFT_TENANT_ID']?.trim() || 'organizations';
  const redirectUri = process.env['LMS_SSO_MICROSOFT_REDIRECT_URI']?.trim()
    || `${resolveAppBaseUrl(request)}/api/auth/sso/microsoft/callback`;
  const allowedDomainsRaw = process.env['LMS_SSO_ALLOWED_EMAIL_DOMAINS']?.trim() || '';

  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
    allowedEmailDomains: new Set(
      allowedDomainsRaw
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  };
}

function encodeBase64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as unknown;
    if (!decoded || typeof decoded !== 'object') {
      return null;
    }
    return decoded as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveMicrosoftSsoEmail(claims: Record<string, unknown>): string | null {
  const candidates = [claims['preferred_username'], claims['email'], claims['upn']];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }

  return null;
}

function buildMicrosoftSsoRedirect(baseUrl: string, params: Record<string, string>) {
  const target = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return target.toString();
}

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(requireAuth);

// --- LMS RESET ENDPOINTS ---
app.post('/api/admin/reset-data', requireAdministrator, async (_request, response, next) => {
  try {
    await repository.write(createDefaultData());
    response.json({ message: 'LMS data reset to default.' });
  } catch (error) {
    next(error);
  }
});

// Rate-limit the login endpoint: max 10 attempts per 15 minutes per IP.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', loginRateLimiter);
app.use('/api/auth/resolve-roles', loginRateLimiter);

// --- FILE UPLOAD ---
// Auto-detect the Firebase Storage bucket from the runtime FIREBASE_CONFIG when
// LMS_STORAGE_BUCKET is not explicitly set. Only resolve from FIREBASE_CONFIG in the
// actual Cloud Function runtime (FUNCTION_NAME / K_SERVICE are set there but NOT during
// the Firebase CLI's local code-analysis step — which would otherwise keep the process
// alive through the pending GCS CORS call and trigger a 10-second loading timeout).
function resolveStorageBucket(): string {
  const explicit = process.env['LMS_STORAGE_BUCKET']?.trim();
  if (explicit) return explicit;
  const isCloudRuntime = process.env['FUNCTION_NAME'] || process.env['K_SERVICE'];
  if (!isCloudRuntime) return '';
  const firebaseConfigRaw = process.env['FIREBASE_CONFIG'];
  if (firebaseConfigRaw) {
    try {
      const config = JSON.parse(firebaseConfigRaw) as { storageBucket?: string };
      if (config.storageBucket) return config.storageBucket;
    } catch {
      // ignore parse errors
    }
  }
  return '';
}
const storageBucket = resolveStorageBucket();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 9 * 1024 * 1024 }, // 9 MB safety cap for small/thumbnail uploads
});

// Legacy local uploads directory (read-only compatibility for older links).
const uploadsDirectory = path.resolve(
  process.env['LMS_UPLOADS_DIRECTORY'] ||
  path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../data/uploads')
);
try {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
} catch {
  // In Cloud Functions environments the deployment directory is read-only;
  // local-disk upload endpoints are unused there — files go through Firebase Storage (GCS).
}

const scormUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

function normalizeScormRelativePath(inputPath: string) {
  const normalized = inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    return '';
  }

  return normalized
    .split('/')
    .filter(Boolean)
    .join('/');
}

function contentTypeForFile(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.html':
    case '.htm':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.xml':
      return 'application/xml; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.mp4':
      return 'video/mp4';
    case '.mp3':
      return 'audio/mpeg';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function resolveScormLaunchEntry(filePaths: string[], manifestContent: string | null) {
  const normalizedPaths = filePaths.map((filePath) => normalizeScormRelativePath(filePath)).filter(Boolean);
  const pathSet = new Set(normalizedPaths);

  if (manifestContent) {
    const hrefMatch = manifestContent.match(/<resource[^>]*href\s*=\s*"([^"]+)"/i);
    const manifestHref = normalizeScormRelativePath(hrefMatch?.[1] ?? '');
    if (manifestHref && pathSet.has(manifestHref)) {
      return manifestHref;
    }
  }

  if (pathSet.has('index.html')) {
    return 'index.html';
  }

  if (pathSet.has('index.htm')) {
    return 'index.htm';
  }

  const firstHtmlPath = normalizedPaths.find((filePath) => filePath.toLowerCase().endsWith('.html') || filePath.toLowerCase().endsWith('.htm'));
  if (firstHtmlPath) {
    return firstHtmlPath;
  }

  return normalizedPaths[0] || '';
}

function encodePathSegments(value: string) {
  return value
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

// Serve uploaded files publicly (no auth required).
app.use('/api/files', express.static(uploadsDirectory, { maxAge: '30d', fallthrough: false }));

// Backward-compatible upload endpoint that now targets Firebase Storage.
app.post('/api/storage/upload-file', upload.single('file'), async (request, response, next) => {
  try {
    if (!storageBucket) {
      response.status(503).json({ message: 'Firebase Storage is not configured on this server.' });
      return;
    }
    if (!request.file) {
      response.status(400).json({ message: 'No file provided.' });
      return;
    }

    const folder = (request.body as { folder?: string }).folder?.replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
    const ext = request.file.originalname.split('.').pop() ?? '';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const filePath = `lms-uploads/${folder}/${safeName}`;

    const adminApp = getApps().length > 0 ? getApp() : initializeApp();
    const bucket = getStorage(adminApp).bucket(storageBucket);
    const storageFile = bucket.file(filePath);

    await storageFile.save(request.file.buffer, { contentType: request.file.mimetype });
    await storageFile.makePublic();

    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${filePath}`;
    response.json({ url: publicUrl, path: filePath });
  } catch (error) {
    next(error);
  }
});

// Configure GCS bucket CORS so browsers can PUT directly to Firebase Storage
// (used by the direct-to-GCS resumable upload flow — see /storage/upload-url below).
async function applyStorageBucketCors() {
  if (!storageBucket) {
    return { applied: false, message: 'Firebase Storage is not configured on this server.' };
  }

  const adminApp = getApps().length > 0 ? getApp() : initializeApp();
  const bucket = getStorage(adminApp).bucket(storageBucket);
  const origins = (process.env['LMS_ALLOWED_ORIGINS'] || '*').split(',').map((o) => o.trim());
  const [setMetadataResult] = await bucket.setMetadata({
    cors: [
      {
        maxAgeSeconds: 3600,
        method: ['GET', 'PUT', 'POST', 'HEAD', 'OPTIONS'],
        origin: origins,
        responseHeader: ['Content-Type', 'x-goog-resumable', 'Content-Range', 'Range'],
      },
    ],
  });

  // Read back from Google directly — setMetadata resolving without throwing does not by
  // itself confirm the value actually persisted, so verify rather than assume.
  const [readBackMetadata] = await bucket.getMetadata();

  return { applied: true, requestedOrigins: origins, setMetadataResponseCors: setMetadataResult?.cors, persistedCors: readBackMetadata?.cors };
}

// Run once per Cloud Function instance at startup (fire-and-forget — non-critical).
// Guard with FUNCTION_NAME/K_SERVICE so the async GCS call does NOT run during the
// Firebase CLI's local code-analysis step (where LMS_STORAGE_BUCKET may still be set
// via .env but the process must exit quickly for the 10-second backend-spec timeout).
const isActualCloudRuntime = Boolean(process.env['FUNCTION_NAME'] || process.env['K_SERVICE']);
if (storageBucket && isActualCloudRuntime) {
  applyStorageBucketCors().catch((error) => {
    console.error('Failed to configure Storage bucket CORS at startup:', error);
  });
}

// Lets an administrator re-run the bucket CORS setup on demand and see the real result —
// the startup attempt above is fire-and-forget, so failures there are otherwise silent.
app.post('/api/admin/storage/configure-cors', requireAdministrator, async (_request, response, next) => {
  try {
    const result = await applyStorageBucketCors();
    response.json(result);
  } catch (error) {
    next(error);
  }
});

// Existing small-file upload through the Cloud Function (kept for thumbnails / tiny assets).
app.post('/api/storage/upload', upload.single('file'), async (request, response, next) => {
  try {
    if (!storageBucket) {
      response.status(503).json({ message: 'Firebase Storage is not configured on this server.' });
      return;
    }
    if (!request.file) {
      response.status(400).json({ message: 'No file provided.' });
      return;
    }
    const folder = (request.body as { folder?: string }).folder?.replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
    const ext = request.file.originalname.split('.').pop() ?? '';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const filePath = `lms-uploads/${folder}/${safeName}`;

    const adminApp = getApps().length > 0 ? getApp() : initializeApp();
    const bucket = getStorage(adminApp).bucket(storageBucket);
    const storageFile = bucket.file(filePath);

    await storageFile.save(request.file.buffer, { contentType: request.file.mimetype });
    await storageFile.makePublic();

    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${filePath}`;
    response.json({ url: publicUrl, path: filePath });
  } catch (error) {
    next(error);
  }
});

app.post('/api/storage/upload-scorm', scormUpload.single('file'), async (request, response, next) => {
  try {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'No SCORM package provided.' });
      return;
    }

    if (!/\.zip$/i.test(file.originalname)) {
      response.status(400).json({ message: 'SCORM uploads must be .zip packages.' });
      return;
    }

    const packageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const packagePrefix = `lms-scorm/${packageId}`;

    let zipEntries: ReturnType<typeof unzipSync>;
    try {
      zipEntries = unzipSync(new Uint8Array(file.buffer));
    } catch {
      response.status(400).json({ message: 'This file is not a valid SCORM .zip package. Please re-export it and try again.' });
      return;
    }

    const safeEntries = Object.entries(zipEntries)
      .map(([entryPath, content]) => ({
        entryPath: normalizeScormRelativePath(entryPath),
        content,
      }))
      .filter((entry) => entry.entryPath.length > 0 && !entry.entryPath.endsWith('/'));

    if (!safeEntries.length) {
      response.status(400).json({ message: 'The SCORM package did not contain any readable files.' });
      return;
    }

    const manifestEntry = safeEntries.find((entry) => entry.entryPath.toLowerCase().endsWith('imsmanifest.xml'));
    const manifestContent = manifestEntry ? Buffer.from(manifestEntry.content).toString('utf-8') : null;
    const launchEntryPath = resolveScormLaunchEntry(safeEntries.map((entry) => entry.entryPath), manifestContent);

    if (!launchEntryPath) {
      response.status(400).json({ message: 'Unable to determine a SCORM launch file.' });
      return;
    }

    if (!storageBucket) {
      response.status(503).json({ message: 'Firebase Storage is not configured on this server.' });
      return;
    }

    const adminApp = getApps().length > 0 ? getApp() : initializeApp();
    const bucket = getStorage(adminApp).bucket(storageBucket);

    for (const entry of safeEntries) {
      const storageFile = bucket.file(`${packagePrefix}/${entry.entryPath}`);
      await storageFile.save(Buffer.from(entry.content), {
        contentType: contentTypeForFile(entry.entryPath),
        resumable: false,
      });
      await storageFile.makePublic();
    }

    // Path-based (not query-string) so relative references inside the SCORM content
    // (<script src="js/app.js">, relative fetch()/XHR, etc.) resolve against the real
    // package folder structure instead of collapsing to /api/storage/.
    const launchUrl = `${resolveAppBaseUrl(request)}/api/storage/scorm/${encodeURIComponent(packageId)}/${encodePathSegments(launchEntryPath)}`;
    response.status(201).json({ packageId, entryPath: launchEntryPath, launchUrl });
  } catch (error) {
    next(error);
  }
});

// SCORM content is untrusted third-party HTML/JS that almost always relies on inline
// <script> to call the SCORM API — Helmet's default CSP (script-src 'self', no
// 'unsafe-inline') silently blocks that, so both SCORM routes strip the CSP header
// Helmet already attached to this response before streaming the asset back.
function stripContentSecurityPolicy(response: express.Response) {
  response.removeHeader('Content-Security-Policy');
  response.removeHeader('Content-Security-Policy-Report-Only');
}

async function streamScormAsset(packageId: string, filePath: string, response: express.Response, next: express.NextFunction) {
  try {
    if (!packageId || !filePath) {
      response.status(400).json({ message: 'packageId and file are required.' });
      return;
    }

    stripContentSecurityPolicy(response);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.setHeader('Content-Type', contentTypeForFile(filePath));

    if (!storageBucket) {
      response.status(503).json({ message: 'Firebase Storage is not configured on this server.' });
      return;
    }

    const adminApp = getApps().length > 0 ? getApp() : initializeApp();
    const bucket = getStorage(adminApp).bucket(storageBucket);
    const storageFile = bucket.file(`lms-scorm/${packageId}/${filePath}`);
    const [exists] = await storageFile.exists();

    if (!exists) {
      response.status(404).json({ message: 'SCORM asset not found.' });
      return;
    }

    storageFile.createReadStream()
      .on('error', next)
      .pipe(response);
  } catch (error) {
    next(error);
  }
}

// Path-based route (current): the URL shape new uploads get, so relative asset
// references inside the SCORM package resolve correctly.
app.get('/api/storage/scorm/:packageId/*splat', async (request, response, next) => {
  const packageId = normalizeScormRelativePath(String(request.params['packageId'] || ''));
  const splatParam = request.params['splat'];
  const rawFilePath = Array.isArray(splatParam) ? splatParam.join('/') : String(splatParam ?? '');
  const filePath = normalizeScormRelativePath(rawFilePath);
  await streamScormAsset(packageId, filePath, response, next);
});

// Query-string route (legacy): kept so SCORM items uploaded before this fix — whose
// saved resourceLink still points at the old shape — keep working, not just new ones.
app.get('/api/storage/scorm', async (request, response, next) => {
  const packageId = normalizeScormRelativePath(String(request.query['packageId'] || ''));
  const filePath = normalizeScormRelativePath(String(request.query['file'] || ''));
  await streamScormAsset(packageId, filePath, response, next);
});

// Direct-to-GCS upload: returns a resumable session URL the browser PUTs to directly.
// This bypasses the Cloud Function 10 MB body limit entirely — supports files of any size.
app.post('/api/storage/upload-url', async (request, response, next) => {
  try {
    if (!storageBucket) {
      response.status(503).json({ message: 'File storage is not configured on this server.' });
      return;
    }
    const { folder, fileName, contentType } = z.object({
      folder: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(64),
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(127),
    }).parse(request.body);

    const ext = fileName.split('.').pop() ?? '';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const filePath = `lms-uploads/${folder}/${safeName}`;

    const adminApp = getApps().length > 0 ? getApp() : initializeApp();
    const bucket = getStorage(adminApp).bucket(storageBucket);
    const storageFile = bucket.file(filePath);

    const [uploadUrl] = await storageFile.createResumableUpload({
      metadata: { contentType },
      public: true, // object will be publicly readable after upload
    });

    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${filePath}`;
    response.json({ uploadUrl, publicUrl, path: filePath });
  } catch (error) {
    next(error);
  }
});

// JSON/base64 upload: works around two Cloud Functions incompatibilities that break
// uploads for small files like the LMS branding logo —
//   1) multer/busboy fails with "Unexpected end of form" because the Functions runtime
//      already buffers the raw request body before Express sees it, so multer's
//      stream-based multipart parser finds nothing left to read.
//   2) the direct-to-GCS resumable PUT (see /storage/upload-url above) requires the
//      bucket's CORS policy to already allow this origin, which is set up as a
//      fire-and-forget background call and isn't guaranteed to have run yet.
// Sending the file as base64 inside a normal JSON body sidesteps both: express.json()
// (50 MB limit, configured above) already parses it reliably, and the object is written
// to Storage server-side via firebase-admin, so the browser never talks to GCS directly.
const maxJsonUploadBytes = 8 * 1024 * 1024;
app.post('/api/storage/upload-base64', async (request, response, next) => {
  try {
    if (!storageBucket) {
      response.status(503).json({ message: 'File storage is not configured on this server.' });
      return;
    }
    const { folder, fileName, contentType, dataBase64 } = z.object({
      folder: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(64),
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(127),
      dataBase64: z.string().min(1),
    }).parse(request.body);

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length > maxJsonUploadBytes) {
      response.status(413).json({ message: 'File is too large. Please upload a file under 8 MB.' });
      return;
    }

    const ext = fileName.split('.').pop() ?? '';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const filePath = `lms-uploads/${folder}/${safeName}`;

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

// Large-file upload: the browser never talks to Google Cloud Storage directly (that path is
// broken — GCS returns the finished object without CORS headers on the completing PUT, so the
// browser blocks reading the response even though the upload actually succeeded server-side).
// Instead the client sends the file in small chunks to this server, which relays each chunk to
// a GCS resumable upload session using firebase-admin (server-to-server, not subject to browser
// CORS at all) — so there's no practical file-size ceiling beyond how long the upload takes.
type ChunkedUploadSession = { gcsUploadUrl: string; path: string; publicUrl: string; createdAt: number };
const chunkedUploadSessions = new Map<string, ChunkedUploadSession>();
const chunkedUploadSessionTtlMs = 60 * 60 * 1000; // 1 hour — generous for a slow connection, not indefinite.

function pruneStaleChunkedUploadSessions() {
  const cutoff = Date.now() - chunkedUploadSessionTtlMs;
  for (const [sessionId, session] of chunkedUploadSessions) {
    if (session.createdAt < cutoff) {
      chunkedUploadSessions.delete(sessionId);
    }
  }
}

app.post('/api/storage/chunked-upload/start', async (request, response, next) => {
  try {
    if (!storageBucket) {
      response.status(503).json({ message: 'File storage is not configured on this server.' });
      return;
    }

    const { folder, fileName, contentType } = z.object({
      folder: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(64),
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(127),
    }).parse(request.body);

    pruneStaleChunkedUploadSessions();

    const ext = fileName.split('.').pop() ?? '';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const filePath = `lms-uploads/${folder}/${safeName}`;

    const adminApp = getApps().length > 0 ? getApp() : initializeApp();
    const bucket = getStorage(adminApp).bucket(storageBucket);
    const [gcsUploadUrl] = await bucket.file(filePath).createResumableUpload({
      metadata: { contentType },
      public: true,
    });

    const sessionId = randomUUID();
    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${filePath}`;
    chunkedUploadSessions.set(sessionId, { gcsUploadUrl, path: filePath, publicUrl, createdAt: Date.now() });

    response.json({ sessionId, path: filePath, publicUrl });
  } catch (error) {
    next(error);
  }
});

app.put('/api/storage/chunked-upload/chunk', async (request, response, next) => {
  try {
    const { sessionId, start, end, total } = z.object({
      sessionId: z.string().min(1),
      start: z.coerce.number().int().min(0),
      end: z.coerce.number().int().min(0),
      total: z.coerce.number().int().min(1),
    }).parse(request.query);

    const session = chunkedUploadSessions.get(sessionId);
    if (!session) {
      response.status(404).json({ message: 'Upload session not found or expired. Please restart the upload.' });
      return;
    }

    // Chunk bodies are raw bytes (application/octet-stream), not JSON, so the global
    // express.json() above leaves them unparsed. Rather than run them through a body-parser
    // stream parser (express.raw() takes 20-30+ seconds for a multi-MB body here — the Functions
    // runtime pre-buffers the whole request before Express sees it, and stream-based parsers
    // interact badly with that already-consumed stream), read the pre-buffered body directly —
    // req.rawBody is populated by the firebase-functions request wrapper before Express runs.
    const chunk = (request as express.Request & { rawBody?: Buffer }).rawBody;
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
      response.status(400).json({ message: 'No chunk data received.' });
      return;
    }

    const gcsResponse = await fetch(session.gcsUploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': String(chunk.length),
      },
      // Cast rather than rely on structural BodyInit matching: editors pinned to a different
      // TypeScript/lib version than the project's (node_modules/typescript, which builds and
      // deploys cleanly) can disagree with Node's own runtime-accurate fetch typing here — and
      // this project's own lib config doesn't even include the DOM-only 'BodyInit' type name.
      body: chunk as any,
    });

    if (gcsResponse.status === 308) {
      // Resume Incomplete — GCS has this chunk, more are expected.
      response.status(202).json({ complete: false });
      return;
    }

    if (gcsResponse.status === 200 || gcsResponse.status === 201) {
      chunkedUploadSessions.delete(sessionId);
      response.json({ complete: true, url: session.publicUrl, path: session.path });
      return;
    }

    chunkedUploadSessions.delete(sessionId);
    const details = await gcsResponse.text().catch(() => '');
    response.status(502).json({ message: `Storage upload failed (status ${gcsResponse.status}).`, details: details.slice(0, 500) });
  } catch (error) {
    next(error);
  }
});

// --- PPTX-to-PDF conversion endpoint ---

const execFileAsync = promisify(execFile);

function findLibreOfficeBinary(): string | null {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];
    return candidates.find((p) => fs.existsSync(p)) ?? null;
  }
  // Linux/macOS — try well-known paths, then rely on PATH
  const candidates = ['/usr/bin/libreoffice', '/usr/bin/soffice', '/usr/local/bin/libreoffice', '/usr/local/bin/soffice'];
  const found = candidates.find((p) => fs.existsSync(p));
  return found ?? 'libreoffice';
}

/**
 * Converts a PPTX buffer to PDF using the Google Drive API.
 * The service account uploads the file, Drive converts it to Google Slides,
 * then we export it as PDF and delete the temporary Drive file.
 * Requires the Drive API to be enabled in the GCP project.
 */
async function convertPptxViaDriveApi(fileBuffer: Buffer): Promise<Buffer> {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive'] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error('Unable to obtain Drive API access token.');

  const boundary = `pptx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({
    name: `pptx_temp_${Date.now()}.pptx`,
    mimeType: 'application/vnd.google-apps.presentation',
  });
  const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  const bodyParts = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${PPTX_MIME}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': String(bodyParts.length),
      },
      body: bodyParts,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => uploadRes.statusText);
    throw new Error(`Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  const { id: fileId } = (await uploadRes.json()) as { id: string };

  try {
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!exportRes.ok) {
      const errText = await exportRes.text().catch(() => exportRes.statusText);
      throw new Error(`Drive export failed (${exportRes.status}): ${errText}`);
    }

    return Buffer.from(await exportRes.arrayBuffer());
  } finally {
    // Best-effort: delete the temporary Drive file after export
    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
  }
}

// Separate multer instance for PPTX conversion — allow larger files (up to 50 MB).
const pptxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.post('/api/storage/convert-pptx', pptxUpload.single('file'), async (request, response, next) => {
  try {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'No file provided.' });
      return;
    }
    const lowerName = file.originalname.toLowerCase();
    if (!lowerName.endsWith('.pptx') && !lowerName.endsWith('.ppt')) {
      response.status(400).json({ message: 'Only .pptx or .ppt files are supported for conversion.' });
      return;
    }

    let pdfBuffer: Buffer;

    const soffice = findLibreOfficeBinary();
    if (soffice) {
      // LibreOffice path (local dev or servers with LibreOffice installed)
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-pptx-'));
      const pptxPath = path.join(tmpDir, 'presentation' + path.extname(file.originalname));
      fs.writeFileSync(pptxPath, file.buffer);

      try {
        await execFileAsync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, pptxPath]);

        const pdfPath = path.join(tmpDir, 'presentation.pdf');
        if (!fs.existsSync(pdfPath)) {
          response.status(500).json({ message: 'PDF conversion failed: the output file was not produced.' });
          return;
        }

        pdfBuffer = fs.readFileSync(pdfPath);
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // Non-critical cleanup failure — temp files will be cleaned by the OS.
        }
      }
    } else {
      // Fallback: Google Drive API (works in Firebase Cloud Functions / Cloud Run)
      pdfBuffer = await convertPptxViaDriveApi(file.buffer);
    }

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
    let pdfUrl: string;

    if (!storageBucket) {
      response.status(503).json({ message: 'Firebase Storage is not configured on this server.' });
      return;
    }

    const filePath = `lms-uploads/content-items/${safeName}`;
    const adminApp = getApps().length > 0 ? getApp() : initializeApp();
    const bucket = getStorage(adminApp).bucket(storageBucket);
    const storageFile = bucket.file(filePath);
    await storageFile.save(pdfBuffer, { contentType: 'application/pdf' });
    await storageFile.makePublic();
    pdfUrl = `https://storage.googleapis.com/${storageBucket}/${filePath}`;

    response.json({ pdfUrl });
  } catch (error) {
    next(error);
  }
});

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    passwordResetEmailConfigured: emailService.isConfigured(),
  });
});

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    passwordResetEmailConfigured: emailService.isConfigured(),
  });
});

app.get('/api/bootstrap', async (_request, response, next) => {
  try {
    response.json(await repository.getBootstrap());
  } catch (error) {
    next(error);
  }
});

app.get('/api/branding', async (_request, response, next) => {
  try {
    response.json(await repository.getBranding());
  } catch (error) {
    next(error);
  }
});

app.put('/api/branding', requireAdministrator, async (request, response, next) => {
  try {
    const payload = brandingSettingsSchema.parse(request.body);
    response.json(await repository.updateBranding(payload));
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const credentials = loginRequestSchema.parse(request.body);
    const authenticated = await repository.authenticate(credentials);

    if (!authenticated) {
      response.status(401).json({ message: 'Invalid login credentials.' });
      return;
    }

    const token = jwt.sign(
      { role: authenticated.role, username: authenticated.username, email: authenticated.email, studentId: authenticated.studentId },
      jwtSecret,
      { expiresIn: jwtExpiresIn },
    );
    response.json({ ...authenticated, token });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/resolve-roles', async (request, response, next) => {
  try {
    const credentials = resolveRolesRequestSchema.parse(request.body);
    let roles = await repository.resolveRoles(credentials);

    if (roles.length === 0) {
      response.status(401).json({ message: 'Invalid login credentials.' });
      return;
    }

    // Administrators and training managers always land on their own student workspace first —
    // give them a real, persistent linked profile right away if they don't already have one.
    const elevatedEntry = roles.find((r) => r.role === 'administrator') ?? roles.find((r) => r.role === 'training-manager');
    if (elevatedEntry && !roles.some((r) => r.role === 'student')) {
      const ensured = await repository.ensureSwitchStudentProfile(elevatedEntry.email);
      if (ensured) {
        roles = [
          ...roles,
          {
            role: 'student' as const,
            route: '/student-profile',
            username: elevatedEntry.username,
            email: elevatedEntry.email,
            studentId: ensured.studentId,
          },
        ];
      }
    }

    const rolesWithTokens = roles.map((r) => ({
      ...r,
      token: jwt.sign(
        { role: r.role, username: r.username, email: r.email, studentId: r.studentId },
        jwtSecret,
        { expiresIn: jwtExpiresIn },
      ),
    }));

    response.json({ roles: rolesWithTokens });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/my-identity', async (request, response, next) => {
  try {
    const payload = readAuthenticatedSessionPayload(request);
    if (!payload?.email) {
      response.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const identity = await repository.resolveAccountIdentity(payload.email);
    response.json({
      name: identity?.name ?? null,
      surname: identity?.surname ?? null,
      profileImageUrl: identity?.profileImageUrl ?? null,
      profileImageDataUrl: identity?.profileImageDataUrl ?? null,
    });
  } catch (error) {
    next(error);
  }
});

const myProfileImageSchema = z.object({
  profileImageUrl: z.string().nullable().optional(),
  profileImageDataUrl: z.string().nullable().optional(),
});

app.put('/api/auth/my-profile-image', async (request, response, next) => {
  try {
    const payload = readAuthenticatedSessionPayload(request);
    if (!payload?.email) {
      response.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const image = myProfileImageSchema.parse(request.body);
    const updated = await repository.updateAccountProfileImage(payload.email, {
      profileImageUrl: image.profileImageUrl ?? null,
      profileImageDataUrl: image.profileImageDataUrl ?? null,
    });

    if (!updated) {
      response.status(404).json({ message: 'No linked profile found for this account.' });
      return;
    }

    response.json({ message: 'Profile picture updated.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/switchable-roles', async (request, response, next) => {
  try {
    const payload = readAuthenticatedSessionPayload(request);
    if (!payload?.email || !payload.role) {
      response.status(401).json({ message: 'Authentication required.' });
      return;
    }

    // Union every role this email really has (e.g. an administrator viewing their student
    // workspace still has their underlying 'administrator' access) with what each of those
    // roles is allowed to switch into — not just what the *current* session's role allows —
    // so the option to go back up is still there no matter which workspace they're currently in.
    const realRoles = await repository.resolveRolesByEmail(payload.email);
    const candidateRoles = new Set<string>();
    for (const entry of realRoles) {
      candidateRoles.add(entry.role);
      for (const fallbackRole of fallbackSwitchableRolesForRole(entry.role)) {
        candidateRoles.add(fallbackRole);
      }
    }
    candidateRoles.delete(payload.role);

    response.json({ roles: Array.from(candidateRoles) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/switch-role', async (request, response, next) => {
  try {
    const { targetRole } = switchRoleRequestSchema.parse(request.body);

    const payload = readAuthenticatedSessionPayload(request);
    if (!payload?.email) {
      response.status(401).json({ message: 'Token payload is invalid.' });
      return;
    }

    const roles = await repository.resolveRolesByEmail(payload.email);
    // Every entry for this email shares the same underlying identity, so any resolved role
    // already carries the real display name — reuse it for fallback matches below too.
    const knownIdentity = roles.find((entry) => entry.name);
    let match: {
      role: 'administrator' | 'training-manager' | 'student';
      route: string;
      username: string;
      email: string;
      studentId?: string;
      name?: string;
      surname?: string;
    } | null | undefined = roles.find((roleEntry) => roleEntry.role === targetRole);

    // An admin/training-manager switching to Student for the first time has no linked student
    // record yet — give them a real, persistent one instead of falling back to a generic session.
    const hasElevatedAccess = roles.some((entry) => entry.role === 'administrator' || entry.role === 'training-manager');
    if (!match && targetRole === 'student' && hasElevatedAccess) {
      const ensured = await repository.ensureSwitchStudentProfile(payload.email);
      if (ensured) {
        match = {
          role: 'student',
          route: '/student-profile',
          username: payload.username,
          email: payload.email,
          studentId: ensured.studentId,
          name: knownIdentity?.name,
          surname: knownIdentity?.surname,
        };
      }
    }

    // Everyone now lands on their Student workspace by default, so the *current* session's role
    // is often 'student' even for an administrator or training manager — check whether any of
    // this email's real underlying roles grants access to targetRole, not just the current one.
    if (!match) {
      const grantingRole = roles.find((entry) => fallbackSwitchableRolesForRole(entry.role).includes(targetRole));
      if (grantingRole) {
        match = {
          role: targetRole,
          route: routeForTargetRole(targetRole),
          username: payload.username,
          email: payload.email,
          studentId: undefined,
          name: knownIdentity?.name,
          surname: knownIdentity?.surname,
        };
      }
    }

    match = match ?? fallbackRoleResolution(payload, targetRole);

    if (!match) {
      response.status(403).json({ message: 'Your account does not have access to this role.' });
      return;
    }

    const newToken = jwt.sign(
      { role: match.role, username: match.username, email: match.email, studentId: match.studentId },
      jwtSecret,
      { expiresIn: jwtExpiresIn },
    );

    response.json({ ...match, token: newToken });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/sso/microsoft/start', async (request, response, next) => {
  try {
    const config = resolveMicrosoftSsoConfig(request);
    if (!config) {
      response.status(503).json({ message: 'Microsoft SSO is not configured on the server.' });
      return;
    }

    const query = microsoftSsoStartQuerySchema.parse({
      role: typeof request.query['role'] === 'string' ? request.query['role'] : undefined,
    });

    const nonce = randomUUID();
    const appBaseUrl = resolveAppBaseUrl(request);
    const stateToken = jwt.sign(
      {
        nonce,
        role: query.role,
        appBaseUrl,
      } satisfies MicrosoftSsoState,
      jwtSecret,
      { expiresIn: '10m' },
    );

    const authorizeUrl = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`);
    authorizeUrl.searchParams.set('client_id', config.clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizeUrl.searchParams.set('response_mode', 'query');
    authorizeUrl.searchParams.set('scope', 'openid profile email');
    authorizeUrl.searchParams.set('state', stateToken);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('prompt', 'select_account');

    response.redirect(authorizeUrl.toString());
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/sso/microsoft/callback', async (request, response, next) => {
  try {
    const config = resolveMicrosoftSsoConfig(request);
    const appBaseUrl = resolveAppBaseUrl(request);

    if (!config) {
      response.redirect(buildMicrosoftSsoRedirect(appBaseUrl, {
        ssoError: 'Microsoft SSO is not configured on the server.',
      }));
      return;
    }

    const providerError = typeof request.query['error'] === 'string' ? request.query['error'] : null;
    if (providerError) {
      const providerErrorDescription = typeof request.query['error_description'] === 'string'
        ? request.query['error_description']
        : 'Sign-in was canceled or rejected by Microsoft.';
      response.redirect(buildMicrosoftSsoRedirect(appBaseUrl, {
        ssoError: providerErrorDescription,
      }));
      return;
    }

    const code = typeof request.query['code'] === 'string' ? request.query['code'] : '';
    const stateToken = typeof request.query['state'] === 'string' ? request.query['state'] : '';

    if (!code || !stateToken) {
      response.redirect(buildMicrosoftSsoRedirect(appBaseUrl, {
        ssoError: 'SSO callback is missing required parameters.',
      }));
      return;
    }

    const verifiedState = jwt.verify(stateToken, jwtSecret) as MicrosoftSsoState;
    const stateAppBaseUrl = typeof verifiedState.appBaseUrl === 'string' && verifiedState.appBaseUrl.trim()
      ? verifiedState.appBaseUrl
      : appBaseUrl;

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, {
        ssoError: 'Microsoft token exchange failed. Please try again.',
      }));
      return;
    }

    const tokenPayload = await tokenResponse.json() as { id_token?: string };
    if (!tokenPayload.id_token) {
      response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, {
        ssoError: 'Microsoft SSO response was incomplete.',
      }));
      return;
    }

    const idTokenClaims = decodeJwtPayload(tokenPayload.id_token);
    if (!idTokenClaims) {
      response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, {
        ssoError: 'Microsoft ID token could not be read.',
      }));
      return;
    }

    const tokenNonce = typeof idTokenClaims['nonce'] === 'string' ? idTokenClaims['nonce'] : '';
    if (!tokenNonce || tokenNonce !== verifiedState.nonce) {
      response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, {
        ssoError: 'SSO validation failed. Please sign in again.',
      }));
      return;
    }

    const email = resolveMicrosoftSsoEmail(idTokenClaims);
    if (!email) {
      response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, {
        ssoError: 'No corporate email address was provided by Microsoft.',
      }));
      return;
    }

    if (config.allowedEmailDomains.size) {
      const domain = email.split('@')[1]?.toLowerCase() || '';
      if (!domain || !config.allowedEmailDomains.has(domain)) {
        response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, {
          ssoError: 'Your email domain is not allowed for SSO access.',
        }));
        return;
      }
    }

    const authenticated = await repository.authenticateSso({
      email,
      role: verifiedState.role,
    });

    if (!authenticated) {
      response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, {
        ssoError: 'This Microsoft account is not linked to an LMS user.',
      }));
      return;
    }

    const token = jwt.sign(
      { role: authenticated.role, username: authenticated.username, email: authenticated.email, studentId: authenticated.studentId },
      jwtSecret,
      { expiresIn: jwtExpiresIn },
    );

    const ssoPayload = encodeBase64UrlJson({
      role: authenticated.role,
      route: authenticated.route,
      username: authenticated.username,
      email: authenticated.email,
      studentId: authenticated.studentId,
      token,
    });

    response.redirect(buildMicrosoftSsoRedirect(stateAppBaseUrl, { sso: ssoPayload }));
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/password-reset/request', async (request, response, next) => {
  try {
    const payload = passwordResetRequestSchema.parse(request.body);

    if (!emailService.isConfigured()) {
      response.status(503).json({ message: 'Password reset email is not configured on the server.' });
      return;
    }

    const resetRequest = await repository.createPasswordResetRequest(payload.email);

    if (resetRequest) {
      const resetUrl = `${resolveAppBaseUrl(request)}/reset-password?token=${encodeURIComponent(resetRequest.token)}`;
      await emailService.sendPasswordResetEmail({
        to: resetRequest.accountEmail,
        username: resetRequest.username,
        resetUrl,
        expiresAt: resetRequest.expiresAt,
      });
    }

    response.status(202).json({ message: 'If that email address exists in the LMS, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/password-reset/validate', async (request, response, next) => {
  try {
    const token = String(request.query['token'] || '');
    if (!token) {
      response.status(400).json({ valid: false, message: 'Reset token is required.' });
      return;
    }

    const status = await repository.getPasswordResetTokenStatus(token);
    response.json(status);
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/password-reset/confirm', async (request, response, next) => {
  try {
    const payload = passwordResetConfirmSchema.parse(request.body);
    const result = await repository.resetPassword(payload.token, payload.password);

    if (!result) {
      response.status(400).json({ message: 'This password reset link is invalid or has expired.' });
      return;
    }

    response.json({
      message: 'Password updated successfully.',
      username: result.username,
      route: result.route,
      role: result.role,
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/change-password', async (request, response, next) => {
  try {
    const payload = changePasswordSchema.parse(request.body);
    const identity = getAuthenticatedIdentity(request);

    // This endpoint has no current-password check, so it must only ever be usable on the
    // caller's own account — otherwise any authenticated session could take over any other
    // account (including an administrator's) just by knowing their email.
    if (!identity || identity.email.trim().toLowerCase() !== payload.email.trim().toLowerCase()) {
      response.status(403).json({ message: 'You can only change your own password.' });
      return;
    }

    const result = await repository.changePassword(payload);

    if (!result) {
      response.status(400).json({ message: 'Password could not be updated.' });
      return;
    }

    response.json({
      message: 'Password updated successfully.',
      username: result.username,
      route: result.route,
      role: result.role,
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/managed-users/credentials', requireAdministrator, async (request, response, next) => {
  try {
    const payload = managedUserCredentialsUpsertSchema.parse(request.body);
    response.json(await repository.upsertManagedUserCredentials(payload.users));
  } catch (error) {
    next(error);
  }
});

app.get('/api/offerings', async (_request, response, next) => {
  try {
    response.json(await repository.listOfferings());
  } catch (error) {
    next(error);
  }
});

app.post('/api/offerings', requireManagerOrAdministrator, async (request, response, next) => {
  try {
    const offering = trainingOfferingSchema.parse(request.body);
    const created = await repository.createOffering(offering);

    if (!created) {
      response.status(409).json({ message: 'An offering with this id already exists.' });
      return;
    }

    response.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put('/api/offerings/:offeringId', requireManagerOrAdministrator, async (request, response, next) => {
  try {
    const update = trainingOfferingUpdateSchema.parse({ ...request.body, id: request.params['offeringId'] });
    const saved = await repository.updateOffering(update);

    if (!saved) {
      response.status(404).json({ message: 'Offering not found.' });
      return;
    }

    response.json(saved);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/offerings/:offeringId', requireManagerOrAdministrator, async (request, response, next) => {
  try {
    const deleted = await repository.deleteOffering(request.params['offeringId'] as string);

    if (!deleted) {
      response.status(404).json({ message: 'Offering not found.' });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/students/:studentId/snapshot', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    // A student may only read their own snapshot; managers/admins may read any student's.
    const isPrivileged = identity.role === 'administrator' || identity.role === 'training-manager';
    if (!isPrivileged && !(await isOwnStudentRecord(request.params.studentId, identity))) {
      response.status(403).json({ message: 'You do not have permission to view this student.' });
      return;
    }

    const snapshot = await repository.getStudentSnapshot(request.params.studentId);

    if (!snapshot) {
      response.status(404).json({ message: 'Student not found.' });
      return;
    }

    response.json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.put('/api/students/:studentId/snapshot', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    // A student may only write their own snapshot; managers/admins may write any student's.
    const isPrivileged = identity.role === 'administrator' || identity.role === 'training-manager';
    if (!isPrivileged && !(await isOwnStudentRecord(request.params.studentId, identity))) {
      response.status(403).json({ message: 'You do not have permission to update this student.' });
      return;
    }

    const snapshot = studentSnapshotUpdateSchema.parse(request.body);
    const updated = await repository.updateStudentSnapshot(request.params.studentId, snapshot);

    if (!updated) {
      response.status(404).json({ message: 'Student not found.' });
      return;
    }

    response.json(updated);
  } catch (error) {
    next(error);
  }
});

// KPI tables are deliberately NOT part of the general student snapshot above — they need a
// write split the snapshot endpoint can't express: a training manager can rewrite every field
// on every row, but a student may only fill in Employee scoring on rows that already exist. Two
// endpoints below enforce that split at the schema level rather than by trusting the client to
// only send the field it's allowed to.
app.put('/api/students/:studentId/kpi-entries', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    if (identity.role !== 'administrator' && identity.role !== 'training-manager') {
      response.status(403).json({ message: 'Only a training manager or administrator can edit a KPI table.' });
      return;
    }

    const body = kpiEntriesReplaceSchema.parse(request.body);

    // A KPI table is meant to add up to a complete picture of the role — a manager saving a
    // table that doesn't sum to 100% (missing coverage, or double-counted) would silently skew
    // every weighted rating downstream (kpiOverallWeightedRating here, the same computation on
    // the student's own view, and the admin performance report/gauge). Rejecting it here is what
    // actually enforces that, rather than just the client-side warning label — a request crafted
    // by hand, or sent before a client-side check existed, would otherwise sail through. Skipped
    // for an empty table (a manager who hasn't set up any KPIs yet isn't required to hit 100% of
    // nothing), and compared with a small tolerance since weights are entered as decimals and can
    // pick up floating-point rounding noise (e.g. three rows of 33.33... summing to 99.99...).
    const totalWeight = body.entries.reduce((total, entry) => total + entry.weight, 0);
    if (body.entries.length > 0 && Math.abs(totalWeight - 100) > 0.01) {
      response.status(400).json({
        message: `The KPI table's total weight must equal 100% before it can be saved (currently ${Math.round(totalWeight * 100) / 100}%).`,
      });
      return;
    }

    const entries = await repository.setKpiEntriesForStudent(request.params.studentId, body.entries);

    if (entries === null) {
      response.status(404).json({ message: 'Student not found.' });
      return;
    }

    response.json({ entries });
  } catch (error) {
    next(error);
  }
});

app.put('/api/students/:studentId/kpi-entries/employee-scoring', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    // A student may only score their own KPI table; managers/admins may score any student's.
    const isPrivileged = identity.role === 'administrator' || identity.role === 'training-manager';
    if (!isPrivileged && !(await isOwnStudentRecord(request.params.studentId, identity))) {
      response.status(403).json({ message: 'You do not have permission to update this student.' });
      return;
    }

    const body = kpiEmployeeScoringUpdateSchema.parse(request.body);
    const entries = await repository.updateKpiEmployeeScoring(request.params.studentId, body.entries);

    if (entries === null) {
      response.status(404).json({ message: 'Student not found.' });
      return;
    }

    // updateKpiEmployeeScoring only merges scoring onto rows that already exist in the CURRENT
    // year's table, matched by id — it never errors on an id it can't find (see repository.ts).
    // That's normally fine (a manager may have removed a row since the client last loaded it),
    // but if NONE of the submitted ids matched anything, the table has changed out from under the
    // client wholesale — most commonly because a manager opened a new KPI year while the client
    // still had the closed year's row ids staged locally. Silently 200-ing that would tell the
    // client its ratings saved when nothing was actually written. Surface it as a conflict instead
    // so the client rolls back its optimistic update and the user sees a real error to retry from.
    const entryIds = new Set(entries.map((entry) => entry.id));
    const matchedCount = body.entries.filter((update) => entryIds.has(update.id)).length;
    if (body.entries.length > 0 && matchedCount === 0) {
      response.status(409).json({
        message: 'These KPI ratings could not be saved because the KPI table has changed — for example, a new review year may have opened. Please refresh and try again.',
      });
      return;
    }

    response.json({ entries });
  } catch (error) {
    next(error);
  }
});

// Performance Gap Analysis: only a training manager or administrator may write it (a low rating
// is theirs to plan a response to, not the employee's to self-report), and — like employee
// scoring — it merges only these three fields onto rows that already exist in the CURRENT year's
// table, matched by id, so it can't be used to sneak an edit to the KPI text, weight, or any
// scoring field through this endpoint.
app.put('/api/students/:studentId/kpi-entries/gap-analysis', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    if (identity.role !== 'administrator' && identity.role !== 'training-manager') {
      response.status(403).json({ message: 'Only a training manager or administrator can update a performance gap analysis.' });
      return;
    }

    const body = kpiGapAnalysisUpdateSchema.parse(request.body);
    const entries = await repository.updateKpiGapAnalysis(request.params.studentId, body.entries);

    if (entries === null) {
      response.status(404).json({ message: 'Student not found.' });
      return;
    }

    // Same stale-table guard as employee-scoring above — see that route for why.
    const entryIds = new Set(entries.map((entry) => entry.id));
    const matchedCount = body.entries.filter((update) => entryIds.has(update.id)).length;
    if (body.entries.length > 0 && matchedCount === 0) {
      response.status(409).json({
        message: 'This performance gap analysis could not be saved because the KPI table has changed — for example, a new review year may have opened. Please refresh and try again.',
      });
      return;
    }

    response.json({ entries });
  } catch (error) {
    next(error);
  }
});

// Bootstrap only carries the current year's KPI entries (see getBootstrap) to keep its payload
// from growing with every year opened; a year selector fetches a past (or current) year here on
// demand instead. Same access rule as scoring a student's table: a student may only see their
// own KPI history, managers/admins may see any student's.
app.get('/api/students/:studentId/kpi-entries/:year', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    const isPrivileged = identity.role === 'administrator' || identity.role === 'training-manager';
    if (!isPrivileged && !(await isOwnStudentRecord(request.params.studentId, identity))) {
      response.status(403).json({ message: 'You do not have permission to view this student.' });
      return;
    }

    const year = Number(request.params.year);
    if (!Number.isInteger(year)) {
      response.status(400).json({ message: 'Year must be a whole number.' });
      return;
    }

    const entries = await repository.getKpiEntriesForStudentYear(request.params.studentId, year);
    if (entries === null) {
      response.status(404).json({ message: 'Student not found.' });
      return;
    }

    response.json({ entries });
  } catch (error) {
    next(error);
  }
});

// The manager-facing "open a new KPI year" action — org-wide, so only a training manager or
// administrator may call it. See repository.openKpiYear for what actually happens: every
// student's current-year KPI definitions are copied forward into a brand-new year with every
// score cleared, the year being closed is left exactly as it was, and currentKpiYear moves
// forward to the new year.
app.post('/api/kpi-years/open', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    if (identity.role !== 'administrator' && identity.role !== 'training-manager') {
      response.status(403).json({ message: 'Only a training manager or administrator can open a new KPI year.' });
      return;
    }

    const body = openKpiYearSchema.parse(request.body);
    const result = await repository.openKpiYear(body.year);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

// `students`, `externalTrainingRequests`, and `trainingManagers` are patched by replacing the
// entire collection (this is how "delete" features work — a record missing from the array is
// treated as deleted). Every legitimate caller only ever removes a few records at a time, from a
// fully-hydrated client list. An array far smaller than the current collection almost certainly
// means the caller sent a partial/stale list by mistake — refuse rather than silently delete
// everything else. Returns an error message, or null if the replacement looks safe.
function checkBulkReplaceGuard(currentCount: number, nextCount: number, label: string): string | null {
  const maxAllowedReduction = Math.max(3, Math.ceil(currentCount * 0.2));
  if (currentCount > 5 && nextCount < currentCount - maxAllowedReduction) {
    return `Refusing to replace ${currentCount} ${label} records with only ${nextCount}. This looks like an incomplete list rather than an intentional bulk delete — if you really do want to remove ${currentCount - nextCount} of them, delete them a few at a time instead.`;
  }

  return null;
}

app.put('/api/manager-state', async (request, response, next) => {
  try {
    const patch = managerStatePatchSchema.parse(request.body);

    if (patch.students || patch.externalTrainingRequests || patch.trainingManagers) {
      // These fields cover the student roster (including role/isAdmin) and the manager
      // directory — student sessions legitimately PATCH this same endpoint for their own
      // mentorship/message data, but must not be able to touch these manager/admin-owned
      // collections, or a student could e.g. grant themselves isAdmin via a roster patch.
      const identity = getAuthenticatedIdentity(request);
      if (!identity || (identity.role !== 'administrator' && identity.role !== 'training-manager')) {
        response.status(403).json({ message: 'You do not have permission to update student, manager, or external training records.' });
        return;
      }

      const dataBefore = await repository.read();

      if (patch.students) {
        const guardMessage = checkBulkReplaceGuard(dataBefore.students.length, patch.students.length, 'student');
        if (guardMessage) {
          response.status(400).json({ message: guardMessage });
          return;
        }
      }

      if (patch.externalTrainingRequests) {
        const guardMessage = checkBulkReplaceGuard(dataBefore.externalTrainingRequests.length, patch.externalTrainingRequests.length, 'external training request');
        if (guardMessage) {
          response.status(400).json({ message: guardMessage });
          return;
        }
      }

      if (patch.trainingManagers) {
        const guardMessage = checkBulkReplaceGuard(dataBefore.trainingManagers.length, patch.trainingManagers.length, 'training manager');
        if (guardMessage) {
          response.status(400).json({ message: guardMessage });
          return;
        }
      }

      // Detect newly assigned offerings so we can email students.
      if (patch.students && emailService.isConfigured()) {
        const prevById = new Map(dataBefore.students.map((s) => [s.id, s]));
        const offeringTitleById = new Map(dataBefore.offerings.map((o) => [o.id, o.title]));
        const offeringDeadlineById = new Map(dataBefore.offerings.map((o) => [o.id, o.completionDeadline]));

        for (const student of patch.students) {
          const prev = prevById.get(student.id);
          const prevIds = new Set(prev?.assignedOfferingIds ?? []);
          const newlyAssigned = student.assignedOfferingIds.filter((id) => !prevIds.has(id));

          for (const offeringId of newlyAssigned) {
            const title = offeringTitleById.get(offeringId);
            if (!title || !student.email) continue;
            emailService.sendCourseAssignedEmail({
              to: student.email,
              studentName: `${student.name} ${student.surname}`.trim(),
              offeringTitle: title,
              deadline: offeringDeadlineById.get(offeringId) ?? '',
              appUrl: resolveAppBaseUrl(request),
            }).catch(() => { /* non-critical — do not fail the request */ });
          }
        }
      }
    }

    response.json(await repository.patchManagerState(patch));
  } catch (error) {
    next(error);
  }
});

app.get('/api/manager-messages', async (request, response, next) => {
  try {
    const data = await repository.read();
    response.json(data.managerMessages);
  } catch (error) {
    next(error);
  }
});

app.post('/api/manager-messages', async (request, response, next) => {
  try {
    const message = managerMessageSchema.parse(request.body);
    await repository.appendManagerMessage(message);
    response.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

app.post('/api/external-training-requests', async (request, response, next) => {
  try {
    const externalTrainingRequest = externalTrainingRequestCreateSchema.parse(request.body);
    const created = await repository.createExternalTrainingRequest(externalTrainingRequest);

    if (!created) {
      response.status(400).json({ message: 'External training request could not be created.' });
      return;
    }

    if (emailService.isConfigured() && created.approvingManagerEmail) {
      emailService.sendTrainingRequestEmail({
        to: created.approvingManagerEmail,
        managerName: created.approvingManagerName,
        studentName: created.studentName,
        courseName: created.courseName,
        provider: created.provider,
        trainingType: created.trainingType,
        startDate: created.trainingStartDate,
        endDate: created.trainingEndDate,
        cost: created.courseCost,
        appUrl: resolveAppBaseUrl(request),
      }).catch(() => { /* non-critical — do not fail the request */ });
    }

    response.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put('/api/external-training-requests/:requestId', async (request, response, next) => {
  try {
    const externalTrainingRequest = externalTrainingRequestUpdateSchema.parse({
      ...request.body,
      requestId: request.params.requestId,
    });
    const updated = await repository.updateExternalTrainingRequest(externalTrainingRequest);

    if (!updated) {
      response.status(404).json({ message: 'External training request not found or unavailable for editing.' });
      return;
    }

    response.json(updated);
  } catch (error) {
    next(error);
  }
});

app.put('/api/external-training-requests/:requestId/review', requireManagerOrAdministrator, async (request, response, next) => {
  try {
    const review = externalTrainingRequestReviewSchema.parse({
      ...request.body,
      requestId: request.params['requestId'],
    });
    const updated = await repository.reviewExternalTrainingRequest(review);

    if (!updated) {
      response.status(404).json({ message: 'External training request not found.' });
      return;
    }

    response.json(updated);
  } catch (error) {
    next(error);
  }
});

app.put('/api/external-training-requests/:requestId/documents', requireManagerOrAdministrator, async (request, response, next) => {
  try {
    const documents = externalTrainingRequestDocumentsSchema.parse({
      ...request.body,
      requestId: request.params['requestId'],
    });
    const updated = await repository.attachExternalTrainingRequestDocuments(documents);

    if (!updated) {
      response.status(404).json({ message: 'External training request not found.' });
      return;
    }

    response.json(updated);
  } catch (error) {
    next(error);
  }
});

app.get('/api/assignment-submissions', async (_request, response, next) => {
  try {
    response.json(await repository.listAssignmentSubmissions());
  } catch (error) {
    next(error);
  }
});

app.get('/api/quiz-submissions', async (_request, response, next) => {
  try {
    response.json(await repository.listQuizSubmissions());
  } catch (error) {
    next(error);
  }
});

// A write is a "review write" when it sets any field only a manager/admin should be able to
// set (status other than the initial Pending Review, or any reviewer field) — as opposed to a
// student's own submit/resubmit, which always lands in Pending Review with no reviewer set yet.
function isReviewWrite(submission: { status: string; reviewerName: string | null; awardedPoints?: number | null; reviewedAt: string | null }) {
  return submission.status !== 'Pending Review'
    || submission.reviewerName !== null
    || submission.reviewedAt !== null
    || (('awardedPoints' in submission) && submission.awardedPoints !== null);
}

app.post('/api/assignment-submissions', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    const submission = assignmentSubmissionSchema.parse(request.body);
    const isManagerOrAdmin = identity.role === 'administrator' || identity.role === 'training-manager';

    if (isReviewWrite(submission)) {
      if (!isManagerOrAdmin) {
        response.status(403).json({ message: 'Only a training manager or administrator can review a submission.' });
        return;
      }
    } else if (!isManagerOrAdmin && !(await isOwnStudentRecord(submission.studentId, identity))) {
      response.status(403).json({ message: 'You can only submit your own assignment.' });
      return;
    }

    response.status(201).json(await repository.upsertAssignmentSubmission(submission));
  } catch (error) {
    next(error);
  }
});

app.post('/api/quiz-submissions', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    const submission = quizSubmissionSchema.parse(request.body);
    const isManagerOrAdmin = identity.role === 'administrator' || identity.role === 'training-manager';

    if (!isManagerOrAdmin && !(await isOwnStudentRecord(submission.studentId, identity))) {
      response.status(403).json({ message: 'You can only submit your own quiz.' });
      return;
    }

    response.status(201).json(await repository.upsertQuizSubmission(submission));
  } catch (error) {
    next(error);
  }
});

app.post('/api/mentorship-submissions', async (request, response, next) => {
  try {
    const identity = getAuthenticatedIdentity(request);
    if (!identity) {
      response.status(401).json({ message: 'Your session has expired. Please log in again.' });
      return;
    }

    const submission = mentorshipSubmissionSchema.parse(request.body);
    const isManagerOrAdmin = identity.role === 'administrator' || identity.role === 'training-manager';

    if (isReviewWrite(submission)) {
      if (!isManagerOrAdmin) {
        response.status(403).json({ message: 'Only a training manager or administrator can review a submission.' });
        return;
      }
    } else if (!isManagerOrAdmin && !(await isOwnStudentRecord(submission.studentId, identity))) {
      response.status(403).json({ message: 'You can only submit your own mentorship response.' });
      return;
    }

    response.status(201).json(await repository.upsertMentorshipSubmission(submission));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ message: 'Invalid request payload.', issues: error.issues });
    return;
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  response.status(500).json({ message });
});

const isFirebaseFunctionRuntime = Boolean(process.env['FUNCTION_TARGET'] || process.env['FIREBASE_CONFIG']);

if (process.env['LMS_SERVER_MODE'] !== 'firebase-function' && !isFirebaseFunctionRuntime) {
  app.listen(port, () => {
    console.log(`LMS API listening on port ${port}`);
  });
}