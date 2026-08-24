import { LmsDataStore } from './contracts.js';
import { createPasswordCredentials } from './auth-utils.js';

const publishedOfferingIds: string[] = [];

function createStudentProfile(name: string, email: string, age: number, contactNumber: string, address: string): LmsDataStore['students'][number]['profile'] {
  return {
    name,
    email,
    idNumber: '',
    age,
    contactNumber,
    address,
    department: 'General',
    jobTitle: 'Not set',
    joined: 'January 2026',
    learningStreak: '8 days',
    profileImageDataUrl: null,
    profileImageUrl: null,
    passwordUpdatedAt: 'Not updated yet',
  };
}

function createMentorshipProfile(name: string, surname: string): LmsDataStore['students'][number]['mentorshipProfile'] {
  return {
    menteeName: name,
    menteeSurname: surname,
    menteeJobTitle: '',
    menteeQualification: '',
    menteeExperience: '',
    mentorName: '',
    mentorSurname: '',
    mentorJobTitle: '',
    mentorQualification: '',
    mentorExperience: '',
  };
}

function createMentorshipObjectives(): LmsDataStore['students'][number]['mentorshipObjectives'] {
  return {
    mentorshipGoals: [{ title: '', date: '', achievementDate: '' }],
    objectives: [{ title: '', date: '', achievementDate: '' }],
  };
}

function createMentorshipProgressReport(): LmsDataStore['students'][number]['mentorshipProgressReport'] {
  return {
    dateOfMeeting: '',
    objectivesAchieved: [{ objectiveAchieved: '', dateAchieved: '' }],
    mentorComments: '',
  };
}

function createStudentSettings(): LmsDataStore['students'][number]['settings'] {
  return {
    notificationPreferences: {
      emailUpdates: true,
      smsAlerts: false,
      assignmentReminders: true,
      messageNotifications: true,
      certificateMilestones: true,
    },
    privacySettings: {
      tutorProfileVisibility: true,
      classmateProfileVisibility: false,
      showEmailAddress: false,
      showContactNumber: false,
    },
    themePreference: null,
  };
}

// Bootstraps a single administrator account so a brand-new deployment isn't unusable — this
// weak default password only works locally: shouldBlockDefaultDemoCredentialLogin() (see
// auth-utils.ts) refuses it on any hosted runtime unless LMS_ALLOW_DEMO_CREDENTIALS=true.
function createAuthAccounts(): LmsDataStore['authAccounts'] {
  const administratorPassword = createPasswordCredentials('admin');

  return [
    {
      id: 'auth-administrator',
      role: 'administrator',
      username: 'admin',
      email: 'admin@skillsconnect.app',
      route: '/admin-profile',
      passwordHash: administratorPassword.passwordHash,
      passwordSalt: administratorPassword.passwordSalt,
    },
  ];
}

/** Shape-only template for a brand-new student record — every field is empty/neutral so it
 *  can be safely spread as defaults under a real, manually-entered student without leaking
 *  a fake identity. Not part of the seeded roster (which starts empty). */
export function createDefaultStudentTemplate(): LmsDataStore['students'][number] {
  return {
    id: '',
    name: '',
    surname: '',
    group: '',
    dateEnrolled: '',
    deadlineDate: '',
    email: '',
    jobTitle: 'Not set',
    idNumber: '',
    activeStatus: 'Active',
    department: 'General',
    lineManager: '',
    status: 'Not Yet Started',
    assignedOfferingIds: [],
    role: 'student',
    isAdmin: false,
    profile: createStudentProfile('', '', 0, '', ''),
    badgeState: { earnedBadgeIds: [] },
    settings: createStudentSettings(),
    mentorshipProfile: createMentorshipProfile('', ''),
    mentorshipObjectives: createMentorshipObjectives(),
    mentorshipProgressReport: createMentorshipProgressReport(),
    notifiedOfferingIds: [...publishedOfferingIds],
    courses: [],
    notifications: [],
    messages: [],
  };
}

export function createDefaultData(): LmsDataStore {
  return {
    offerings: [],
    students: [],
    trainingManagers: [],
    managerMessages: [],
    mentorshipAssignments: [],
    assignmentSubmissions: [],
    mentorshipSubmissions: [],
    quizSubmissions: [],
    externalTrainingRequests: [],
    branding: {
      themeId: 'ocean',
      companyLogoDataUrl: null,
    },
    authAccounts: createAuthAccounts(),
    passwordResetTokens: [],
    updatedAt: new Date().toISOString(),
    currentKpiYear: new Date().getFullYear(),
    kpiYearsOpened: [new Date().getFullYear()],
    hrIntegration: {
      enabled: false,
      baseUrl: '',
      authHeaderName: 'Authorization',
      authHeaderValue: '',
      lastSyncSummary: null,
    },
  };
}