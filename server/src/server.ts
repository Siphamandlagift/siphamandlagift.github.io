import 'dotenv/config';
// ...existing code...
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { createDefaultData } from './default-data.js';
import { createLmsRepository } from './repository.js';
import { PasswordResetEmailService } from './email-service.js';

// Set the base URL for the app, defaulting to the Angular frontend
const appBaseUrl = process.env['LMS_APP_BASE_URL'] || 'http://localhost:4200';
const allowedOrigins = new Set(
  (process.env['LMS_ALLOWED_ORIGINS'] || 'http://localhost:4200,https://skillsconnect-f2275.web.app,https://skillsconnect-f2275.firebaseapp.com')
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
const jwtSecret = process.env['LMS_JWT_SECRET'] || 'lms-dev-secret-change-in-production';
const jwtExpiresIn = '12h';

// Routes that do not require a JWT token.
const publicPaths = new Set([
  '/health',
  '/api/branding',
  '/api/auth/login',
  '/api/auth/password-reset/request',
  '/api/auth/password-reset/validate',
  '/api/auth/password-reset/confirm',
]);

function requireAuth(request: express.Request, response: express.Response, next: express.NextFunction) {
  // Publicly readable uploaded files do not require auth.
  if (publicPaths.has(request.path) || request.path.startsWith('/api/files/')) {
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

// --- LMS RESET ENDPOINTS ---
app.post('/api/admin/reset-data', async (_request, response, next) => {
  try {
    await repository.write(createDefaultData());
    response.json({ message: 'LMS data reset to default.' });
  } catch (error) {
    next(error);
  }
});


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
  kind: z.enum(['Video', 'Assessment', 'Document']),
  title: z.string().min(1),
  assessmentType: z.enum(['Quiz', 'Assignment', 'Mentorship', 'Read and Acknowledge']).nullable(),
  passMarkPercentage: z.number().int().min(1).max(100).optional(),
  maxAttempts: z.number().int().min(1).optional(),
  resourceLink: z.string(),
  uploadedFileName: z.string(),
  uploadedFileDataUrl: z.string().optional(),
  requiresAcknowledgement: z.boolean().optional(),
  questions: z.array(trainingAssessmentQuestionSchema),
});

const trainingOfferingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['Course', 'Programme']),
  category: z.string().min(1),
  description: z.string().min(1),
  completionDeadline: z.string().min(1),
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
  completionDeadline: z.string().min(1),
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
  status: z.enum(['Pending Review', 'Approved', 'Needs Revision']),
  submittedAt: z.string(),
  reviewerName: z.string().nullable(),
  reviewerFeedback: z.string(),
  reviewedAt: z.string().nullable(),
});

const externalTrainingRequestInputSchema = z.object({
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

const enrollmentStudentRoleSchema = z.enum(['student', 'manager', 'admin', 'training-manager', 'administrator'])
  .transform((role) => {
    if (role === 'training-manager') {
      return 'manager';
    }

    if (role === 'administrator') {
      return 'admin';
    }

    return role;
  });

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
  status: z.enum(['Completed', 'In Progress', 'Not Yet Started']),
  assignedOfferingIds: z.array(z.string()),
  role: enrollmentStudentRoleSchema,
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
  age: z.number().min(1),
  contactNumber: z.string().min(1),
  address: z.string().min(1),
  programme: z.string().min(1),
  level: z.string().min(1),
  joined: z.string().min(1),
  learningStreak: z.string().min(1),
  profileImageDataUrl: z.string().nullable(),
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

const studentAssessmentAttemptSchema = z.object({
  attemptsUsed: z.number().int().min(1),
  passed: z.boolean(),
  lastScorePercentage: z.number().min(0).max(100),
  lastScoreEarned: z.number().min(0),
  lastScorePossible: z.number().min(0),
  lastSubmittedAt: z.string().min(1),
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
  themePreference: z.enum(['ocean', 'forest', 'sunrise', 'purple', 'black', 'grey']),
});

const brandingSettingsSchema = z.object({
  themeId: z.enum(['ocean', 'forest', 'sunrise', 'purple', 'black', 'grey']),
  companyLogoDataUrl: z.string().nullable(),
});

const studentSnapshotUpdateSchema = z.object({
  profile: studentProfileSchema,
  badgeState: studentBadgeStateSchema,
  settings: studentSettingsSchema,
  mentorshipProfile: studentMentorshipProfileSchema,
  mentorshipObjectives: studentMentorshipObjectivesSchema,
  mentorshipProgressReport: studentMentorshipProgressReportSchema,
  courses: z.array(studentCourseSchema),
  notifications: z.array(studentNotificationSchema),
  messages: z.array(studentMessageSchema),
  notifiedOfferingIds: z.array(z.string()),
  assessmentAttempts: z.record(z.string(), studentAssessmentAttemptSchema),
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

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const managedUserCredentialSchema = z.object({
  studentId: z.string().min(1),
  email: z.string().email(),
  role: enrollmentStudentRoleSchema,
  password: z.string().min(8),
});

const managedUserCredentialsUpsertSchema = z.object({
  users: z.array(managedUserCredentialSchema),
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(requireAuth);

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

// --- FILE UPLOAD ---
const storageBucket = process.env['LMS_STORAGE_BUCKET'] || '';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 9 * 1024 * 1024 }, // 9 MB safety cap for small/thumbnail uploads
});

// Disk-based upload storage — no file size limit, persists independently of GCS.
const uploadsDirectory = path.resolve(
  process.env['LMS_UPLOADS_DIRECTORY'] ||
  path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../data/uploads')
);
fs.mkdirSync(uploadsDirectory, { recursive: true });

const diskUpload = multer({
  storage: multer.diskStorage({
    destination(_req, file, cb) {
      // Folder is parsed from the multipart field before multer processes the file;
      // fall back to 'uploads' for safety.
      const rawFolder = ((_req.body as { folder?: string }).folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
      const dest = path.join(uploadsDirectory, rawFolder);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  // No fileSize limit — supports documents, images, and large uploads.
});

// Serve uploaded files publicly (no auth required).
app.use('/api/files', express.static(uploadsDirectory, { maxAge: '30d', fallthrough: false }));

// Direct disk upload endpoint — used as fallback when GCS is not configured.
app.post('/api/storage/upload-file', diskUpload.fields([{ name: 'file', maxCount: 1 }]), (request, response, next) => {
  try {
    const files = request.files as Record<string, Express.Multer.File[]> | undefined;
    const uploadedFile = files?.['file']?.[0];
    if (!uploadedFile) {
      response.status(400).json({ message: 'No file provided.' });
      return;
    }
    const rawFolder = ((request.body as { folder?: string }).folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    const publicUrl = `${appBaseUrl}/api/files/${rawFolder}/${uploadedFile.filename}`;
    response.json({ url: publicUrl, path: `${rawFolder}/${uploadedFile.filename}` });
  } catch (error) {
    next(error);
  }
});

// Configure GCS bucket CORS at startup so browsers can PUT directly to Firebase Storage.
// This runs once per Cloud Function instance (fire-and-forget — non-critical).
if (storageBucket) {
  void (async () => {
    try {
      const adminApp = getApps().length > 0 ? getApp() : initializeApp();
      const bucket = getStorage(adminApp).bucket(storageBucket);
      const origins = (process.env['LMS_ALLOWED_ORIGINS'] || '*').split(',').map((o) => o.trim());
      await bucket.setMetadata({
        cors: [
          {
            maxAgeSeconds: 3600,
            method: ['GET', 'PUT', 'POST', 'HEAD', 'OPTIONS'],
            origin: origins,
            responseHeader: ['Content-Type', 'x-goog-resumable', 'Content-Range', 'Range'],
          },
        ],
      });
    } catch {
      // Non-critical — direct uploads will still attempt, small file path remains as fallback.
    }
  })();
}

// Existing small-file upload through the Cloud Function (kept for thumbnails / tiny assets).
app.post('/api/storage/upload', upload.single('file'), async (request, response, next) => {
  try {
    if (!storageBucket) {
      response.status(503).json({ message: 'File storage is not configured on this server.' });
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
    response.json({ uploadUrl, publicUrl });
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

app.put('/api/branding', async (request, response, next) => {
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
      { role: authenticated.role, username: authenticated.username, email: authenticated.email },
      jwtSecret,
      { expiresIn: jwtExpiresIn },
    );
    response.json({ ...authenticated, token });
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
      const resetUrl = `${appBaseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetRequest.token)}`;
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

app.post('/api/auth/managed-users/credentials', async (request, response, next) => {
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

app.post('/api/offerings', async (request, response, next) => {
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

app.put('/api/offerings/:offeringId', async (request, response, next) => {
  try {
    const update = trainingOfferingUpdateSchema.parse({ ...request.body, id: request.params.offeringId });
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

app.delete('/api/offerings/:offeringId', async (request, response, next) => {
  try {
    const deleted = await repository.deleteOffering(request.params.offeringId);

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

app.put('/api/manager-state', async (request, response, next) => {
  try {
    const patch = managerStatePatchSchema.parse(request.body);

    // Detect newly assigned offerings so we can email students.
    if (patch.students && emailService.isConfigured()) {
      const dataBefore = await repository.read();
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
            appUrl: appBaseUrl,
          }).catch(() => { /* non-critical — do not fail the request */ });
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
        appUrl: appBaseUrl,
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

app.put('/api/external-training-requests/:requestId/review', async (request, response, next) => {
  try {
    const review = externalTrainingRequestReviewSchema.parse({
      ...request.body,
      requestId: request.params.requestId,
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

app.post('/api/assignment-submissions', async (request, response, next) => {
  try {
    const submission = assignmentSubmissionSchema.parse(request.body);
    response.status(201).json(await repository.upsertAssignmentSubmission(submission));
  } catch (error) {
    next(error);
  }
});

app.post('/api/quiz-submissions', async (request, response, next) => {
  try {
    const submission = quizSubmissionSchema.parse(request.body);
    response.status(201).json(await repository.upsertQuizSubmission(submission));
  } catch (error) {
    next(error);
  }
});

app.post('/api/mentorship-submissions', async (request, response, next) => {
  try {
    const submission = mentorshipSubmissionSchema.parse(request.body);
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