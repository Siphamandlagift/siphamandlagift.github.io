import { effect, Injectable, computed, inject, signal, untracked } from '@angular/core';
import { firstValueFrom, interval } from 'rxjs';
import { LmsBackendService } from './lms-backend.service';
import { LmsBrandThemeId } from './lms-branding.service';
import { ManagerMessage, ManagerMessageReply, TrainingManagerDataService, TrainingOffering } from './training-manager-data.service';

export type StudentProfileData = {
  name: string;
  email: string;
  idNumber: string;
  age: number;
  contactNumber: string;
  address: string;
  department: string;
  jobTitle: string;
  joined: string;
  learningStreak: string;
  profileImageDataUrl: string | null;
  profileImageUrl: string | null;
  passwordUpdatedAt: string;
};

export type StudentMentorshipProfile = {
  menteeName: string;
  menteeSurname: string;
  menteeJobTitle: string;
  menteeQualification: string;
  menteeExperience: string;
  mentorName: string;
  mentorSurname: string;
  mentorJobTitle: string;
  mentorQualification: string;
  mentorExperience: string;
};

export type StudentMentorshipObjectives = {
  mentorshipGoals: StudentMentorshipObjectiveEntry[];
  objectives: StudentMentorshipObjectiveEntry[];
};

export type StudentMentorshipObjectiveEntry = {
  title: string;
  date: string;
  achievementDate: string;
};

export type StudentMentorshipProgressEntry = {
  objectiveAchieved: string;
  dateAchieved: string;
};

export type StudentMentorshipProgressReport = {
  dateOfMeeting: string;
  objectivesAchieved: StudentMentorshipProgressEntry[];
  mentorComments: string;
};

export type StudentDashboardStats = {
  enrolledCourses: number;
  hoursEarned: number;
  badgesEarned: number;
  courseFootnote: string;
  hoursFootnote: string;
  badgesFootnote: string;
  weeklyConsistency: number;
  upcomingTasks: string;
};

export type StudentNotification = {
  id: string;
  badge: string;
  title: string;
  body: string;
  dateLabel: string;
  createdAt?: string;
  unread: boolean;
  dismissed?: boolean;
};

export type StudentMessage = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  replies: StudentMessageReply[];
};

export type StudentMessageReply = {
  id: string;
  sender: string;
  body: string;
  time: string;
  authorType: 'student' | 'contact';
  deliveryState?: 'Sent' | 'Delivered';
};

export type StudentCourse = {
  offeringId?: string;
  name: string;
  progress?: number;
  image: string;
  completed: boolean;
  completedAt?: string;
  description: string;
};

export type StudentCalendarEvent = {
  id: string;
  date: Date;
  title: string;
  courseName?: string;
  offeringId?: string;
  stepId?: string;
  actionLabel?: string;
};

export type StudentCourseNavigationRequest = {
  courseName: string;
  offeringId?: string;
  stepId?: string;
};

export type StudentAssessmentAttempt = {
  attemptsUsed: number;
  passed: boolean;
  lastScorePercentage: number;
  lastScoreEarned: number;
  lastScorePossible: number;
  lastSubmittedAt: string;
};

type StudentEngagementState = {
  /** Number of consecutive calendar days the student has engaged with any course. */
  streakDays: number;
  /** ISO date string (YYYY-MM-DD) of the most recent engagement. */
  lastEngagedDate: string;
};

export type StudentBadge = {
  id: string;
  title: string;
  category: string;
  description: string;
  earnedOn: string;
  color: string;
  icon: 'star' | 'bolt' | 'book' | 'flask';
  earned: boolean;
};

type StudentDashboardBaseStats = {
  badgesFootnote: string;
  weeklyConsistency: number;
};

type StudentBadgeDefinition = Omit<StudentBadge, 'earned' | 'earnedOn'> & {
  earnedOnWhenLocked: string;
};

export type StudentBadgeState = {
  earnedBadgeIds: string[];
};

export type StudentCertificateStatus = 'Active' | 'Expired' | 'Pending Renewal';

export type StudentCertificateLicence = {
  id: string;
  certificationName: string;
  completionDate: string;
  expiryDate: string;
  fileName: string;
  fileDataUrl: string;
  status: StudentCertificateStatus;
  renewalRequired: 'Yes' | 'No';
  reminderNotification: 'Yes' | 'No';
  reminderDaysBeforeExpiry: number;
};

export type StudentNotificationPreferences = {
  emailUpdates: boolean;
  smsAlerts: boolean;
  assignmentReminders: boolean;
  messageNotifications: boolean;
  certificateMilestones: boolean;
};

export type StudentPrivacySettings = {
  tutorProfileVisibility: boolean;
  classmateProfileVisibility: boolean;
  showEmailAddress: boolean;
  showContactNumber: boolean;
};

export type StudentSettingsData = {
  notificationPreferences: StudentNotificationPreferences;
  privacySettings: StudentPrivacySettings;
  themePreference: LmsBrandThemeId;
};

export type StudentProfileUpdateResult = {
  success: boolean;
  errorMessage?: string;
};

type PersistedStudentSnapshot = {
  studentId: string;
  profile: StudentProfileData;
  badgeState: StudentBadgeState;
  certificatesAndLicences: StudentCertificateLicence[];
  settings: StudentSettingsData;
  mentorshipProfile: StudentMentorshipProfile;
  mentorshipObjectives: StudentMentorshipObjectives;
  mentorshipProgressReport: StudentMentorshipProgressReport;
  courses: StudentCourse[];
  notifications: StudentNotification[];
  messages: StudentMessage[];
  notifiedOfferingIds: string[];
  assessmentAttempts: Record<string, StudentAssessmentAttempt>;
  engagementState?: StudentEngagementState;
};

@Injectable({ providedIn: 'root' })
export class StudentDataService {
  private static readonly studentSnapshotStorageKeyPrefix = 'lms-app.student-snapshot';
  private static readonly badgesStorageKey = 'lms-app.student-badges';
  private static readonly mentorshipProfileStorageKey = 'lms-app.student-mentorship-profile';
  private static readonly mentorshipObjectivesStorageKey = 'lms-app.student-mentorship-objectives';
  private static readonly mentorshipProgressReportStorageKey = 'lms-app.student-mentorship-progress-report';
  private static readonly notifiedOfferingIdsStorageKey = 'lms-app.student-notified-offering-ids';
  private static readonly snapshotRefreshIntervalMs = 10000;
  private static readonly legacySeedCourseTitles = new Set([
    'Company Induction',
    'Project Management Fundamentals',
    'Leadership Readiness Programme',
    'Sexual Harassment In The Workplace',
    'Workplace Communication Essentials',
    'Data Protection And Compliance',
  ]);

  private readonly managerData = inject(TrainingManagerDataService);
  private readonly backend = inject(LmsBackendService);
  private backendHydrated = false;
  private readonly initialPersistedStudentSnapshot = this.loadPersistedStudentSnapshot();
  private studentStateHydrated = !!this.initialPersistedStudentSnapshot;
  private pendingSnapshotWriteCount = 0;
  private refreshInFlight = false;

  private readonly profileSignal = signal<StudentProfileData>(
    this.initialPersistedStudentSnapshot?.profile ?? this.createInitialProfile(),
  );

  private readonly mentorshipProfileSignal = signal<StudentMentorshipProfile>(
    this.initialPersistedStudentSnapshot?.mentorshipProfile ?? this.loadMentorshipProfile(),
  );
  private readonly mentorshipObjectivesSignal = signal<StudentMentorshipObjectives>(
    this.initialPersistedStudentSnapshot?.mentorshipObjectives ?? this.loadMentorshipObjectives(),
  );
  private readonly mentorshipProgressReportSignal = signal<StudentMentorshipProgressReport>(
    this.initialPersistedStudentSnapshot?.mentorshipProgressReport ?? this.loadMentorshipProgressReport(),
  );
  private readonly settingsSignal = signal<StudentSettingsData>(
    this.initialPersistedStudentSnapshot?.settings ?? this.createInitialSettings(),
  );

  private readonly dashboardBaseStatsSignal = signal<StudentDashboardBaseStats>({
    badgesFootnote: 'Next badge at 80 hours',
    weeklyConsistency: 78,
  });

  private readonly coursesSignal = signal<StudentCourse[]>(
    this.filterLegacySeedCourses(this.initialPersistedStudentSnapshot?.courses ?? []),
  );
  private readonly certificatesAndLicencesSignal = signal<StudentCertificateLicence[]>(
    this.initialPersistedStudentSnapshot?.certificatesAndLicences ?? [],
  );
  private readonly assessmentAttemptsSignal = signal<Record<string, StudentAssessmentAttempt>>(
    this.initialPersistedStudentSnapshot?.assessmentAttempts ?? {},
  );

  private readonly courseNavigationRequestSignal = signal<StudentCourseNavigationRequest | null>(null);

  private readonly badgeDefinitions: StudentBadgeDefinition[] = [
    {
      id: 'fast-finisher',
      title: 'Fast Finisher',
      category: 'Performance',
      description: 'Completed a weekly task before the due date three times in a row.',
      color: '#6366f1',
      icon: 'bolt',
      earnedOnWhenLocked: 'Complete 3 early submissions',
    },
    {
      id: 'consistency-star',
      title: 'Consistency Star',
      category: 'Attendance',
      description: 'Maintained a 7-day learning streak in the student workspace.',
      color: '#f59e0b',
      icon: 'star',
      earnedOnWhenLocked: 'Reach a 7-day streak',
    },
    {
      id: 'induction-complete',
      title: 'Induction Complete',
      category: 'Completion',
      description: 'Completed the Company Induction course and unlocked your onboarding certificate.',
      color: '#10b981',
      icon: 'book',
      earnedOnWhenLocked: 'Complete Company Induction',
    },
    {
      id: 'respect-at-work',
      title: 'Respect At Work',
      category: 'Achievement',
      description: 'Complete Sexual Harassment In The Workplace training to unlock this badge.',
      color: '#0ea5e9',
      icon: 'flask',
      earnedOnWhenLocked: 'Complete Sexual Harassment training',
    },
  ];

  private readonly persistedEarnedBadgeIdsSignal = signal<string[]>(
    this.initialPersistedStudentSnapshot?.badgeState.earnedBadgeIds ?? this.loadPersistedBadgeIds(),
  );
  private readonly notifiedOfferingIdsSignal = signal<string[]>(
    this.initialPersistedStudentSnapshot?.notifiedOfferingIds ?? this.loadNotifiedOfferingIds(this.managerData.offerings()),
  );

  private readonly notificationsSignal = signal<StudentNotification[]>(
    this.initialPersistedStudentSnapshot?.notifications ?? this.createInitialNotifications(),
  );

  private readonly messagesSignal = signal<StudentMessage[]>(
    this.initialPersistedStudentSnapshot?.messages ?? this.createInitialMessages(),
  );

  private readonly engagementSignal = signal<StudentEngagementState>(
    this.initialPersistedStudentSnapshot?.engagementState ?? { streakDays: 0, lastEngagedDate: '' },
  );

  readonly profile = this.profileSignal.asReadonly();
  readonly settings = this.settingsSignal.asReadonly();
  readonly mentorshipProfile = this.mentorshipProfileSignal.asReadonly();
  readonly mentorshipObjectives = this.mentorshipObjectivesSignal.asReadonly();
  readonly mentorshipProgressReport = this.mentorshipProgressReportSignal.asReadonly();
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly messages = this.messagesSignal.asReadonly();
  readonly courses = this.coursesSignal.asReadonly();
  readonly certificatesAndLicences = this.certificatesAndLicencesSignal.asReadonly();
  readonly calendarEvents = computed(() => this.buildCalendarEvents(this.coursesSignal(), this.managerData.offerings()));
  readonly courseNavigationRequest = this.courseNavigationRequestSignal.asReadonly();
  readonly assessmentAttempts = this.assessmentAttemptsSignal.asReadonly();
  readonly loadedTrainingManagers = computed(() => this.managerData.trainingManagers());
  readonly badges = computed<StudentBadge[]>(() => {
    const persistedIds = new Set(this.persistedEarnedBadgeIdsSignal());
    const completedCourses = this.completedCourses();
    const learningStreakDays = this.learningStreakDays();
    const fastFinisherEarnedOn = this.fastFinisherEarnedOn();

    return this.badgeDefinitions.map((badge) => {
      const earned = persistedIds.has(badge.id) || this.isBadgeEarnedByRules(badge.id, completedCourses, learningStreakDays, fastFinisherEarnedOn);

      if (earned && !persistedIds.has(badge.id)) {
        queueMicrotask(() => this.persistBadgeUnlock(badge.id));
      }

      return {
        ...badge,
        earned,
        earnedOn: earned ? this.resolveEarnedDate(badge.id, fastFinisherEarnedOn) : badge.earnedOnWhenLocked,
      };
    });
  });
  readonly earnedBadges = computed(() => this.badges().filter((badge) => badge.earned));

  readonly displayName = computed(() => this.profile().name.split(' ')[0] || this.profile().name);
  readonly completedCourses = computed(() => this.courses().filter((course) => course.completed));
  readonly inProgressCourses = computed(() => this.courses().filter((course) => !course.completed));
  readonly dashboardStats = computed<StudentDashboardStats>(() => {
    const stats = this.dashboardBaseStatsSignal();
    const courses = this.courses();
    const offerings = this.managerData.offerings();
    const earnedBadges = this.earnedBadges();
    const nextBadge = this.badges().find((badge) => !badge.earned);
    const upcomingEvents = this.calendarEvents().filter((event) => event.date >= this.startOfToday());
    const nearCompletionCount = courses.filter((course) => !course.completed && (course.progress ?? 0) >= 75).length;
    const totalTrainingMinutesSpent = courses.reduce(
      (totalMinutes, course) => totalMinutes + this.calculateCourseMinutesSpent(course, offerings),
      0,
    );

    return {
      enrolledCourses: courses.length,
      hoursEarned: this.formatTrainingHours(totalTrainingMinutesSpent),
      badgesEarned: earnedBadges.length,
      courseFootnote: nearCompletionCount
        ? `${nearCompletionCount} course${nearCompletionCount === 1 ? '' : 's'} near completion`
        : `${this.completedCourses().length} course${this.completedCourses().length === 1 ? '' : 's'} completed`,
      hoursFootnote: totalTrainingMinutesSpent > 0
        ? `${this.formatTrainingMinutes(totalTrainingMinutesSpent)} spent across active training progress`
        : 'Hours will update as you complete training course steps',
      badgesFootnote: nextBadge ? `Next badge: ${nextBadge.title}` : stats.badgesFootnote,
      weeklyConsistency: this.consistencyPercent(),
      upcomingTasks: `${upcomingEvents.length} upcoming task${upcomingEvents.length === 1 ? '' : 's'}`,
    };
  });
  readonly unreadNotificationsCount = computed(() => this.notifications().filter((item) => item.unread && !item.dismissed).length);
  readonly unreadMessagesCount = computed(() => this.messages().filter((item) => item.unread).length);
  readonly earnedBadgesCount = computed(() => this.earnedBadges().length);

  /**
   * The effective learning streak (consecutive days engaged).
   * Returns 0 if the streak has been broken (last engagement was before yesterday).
   */
  readonly currentEngagementStreak = computed(() => {
    const { streakDays, lastEngagedDate } = this.engagementSignal();
    const today = this.todayDateString();
    const yesterday = this.yesterdayDateString();
    return lastEngagedDate === today || lastEngagedDate === yesterday ? streakDays : 0;
  });

  /** 100 when the student has an active streak, 0 when it has been broken. */
  readonly consistencyPercent = computed(() => (this.currentEngagementStreak() > 0 ? 100 : 0));

  readonly consistencyLabel = computed(() => {
    const streak = this.currentEngagementStreak();
    if (streak > 0) {
      return `${streak} day${streak !== 1 ? 's' : ''} streak — keep it up!`;
    }
    return 'Engage with a course today to start your streak';
  });
  readonly profileHighlights = computed(() => {
    const profile = this.profile();
    return [
      { label: 'Department', value: profile.department },
      { label: 'Job title', value: profile.jobTitle },
      { label: 'ID number', value: profile.idNumber || 'Not provided' },
      { label: 'Contact', value: profile.contactNumber },
      { label: 'Address', value: profile.address },
      { label: 'Joined', value: profile.joined },
      {
        label: 'Learning streak',
        value: (() => {
          const streak = this.currentEngagementStreak();
          return streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''}` : 'No active streak';
        })(),
      },
      { label: 'Password', value: profile.passwordUpdatedAt },
    ];
  });

  constructor() {
    this.refreshStudentSnapshot(true);
    interval(StudentDataService.snapshotRefreshIntervalMs).subscribe(() => {
      this.refreshStudentSnapshot();
    });

    effect(
      () => {
        // Wait until the manager backend data has loaded before syncing offerings.
        // Without this guard the effect fires immediately with an empty offerings signal,
        // wiping every student course (and resetting progress to 0) before real data arrives.
        if (!this.managerData.offeringsHydrated()) {
          return;
        }

        const publishedOfferings = this.managerData.offerings().filter((offering) => offering.status === 'Published');
        const knownNotifiedIds = this.notifiedOfferingIdsSignal();

        // Scope course sync and notifications to only the offerings this specific student is assigned to.
        const currentStudentId = this.currentSessionStudentId();
        const assignedOfferingIds = new Set(
          this.managerData.students().find((s) => s.id === currentStudentId)?.assignedOfferingIds ?? [],
        );
        const assignedPublishedOfferings = publishedOfferings.filter((o) => assignedOfferingIds.has(o.id));
        const assignedPublishedIds = assignedPublishedOfferings.map((o) => o.id);

        untracked(() => {
          this.syncPublishedOfferingsToLearnerCourses(assignedPublishedOfferings);
          // Prune notifications for offerings the student is no longer assigned to (or that are unpublished).
          this.pruneRemovedOfferingNotifications(assignedPublishedIds);
          this.pruneRemovedOfferingAssessmentAttempts(publishedOfferings);
          this.addNotificationsForNewOfferings(assignedPublishedOfferings, knownNotifiedIds);

          // Track only assigned offering IDs so future assignments generate fresh notifications.
          if (this.haveOfferingIdsChanged(knownNotifiedIds, assignedPublishedIds)) {
            this.notifiedOfferingIdsSignal.set(assignedPublishedIds);
            this.saveNotifiedOfferingIds(assignedPublishedIds);
          }

          this.persistStudentSnapshot();
        });
      },
    );
  }

  refreshForCurrentSession() {
    this.applyPersistedStudentStateForCurrentSession();
    this.refreshStudentSnapshot(true);
  }

  updateCertificatesAndLicences(records: StudentCertificateLicence[]) {
    this.certificatesAndLicencesSignal.set(records);
    this.persistStudentSnapshot();
  }

  async updateProfile(
    profile: Pick<StudentProfileData, 'name' | 'email' | 'idNumber' | 'age' | 'contactNumber' | 'address'> & {
      profileImageDataUrl?: string | null;
      profileImageUrl?: string | null;
      newPassword?: string;
    },
  ): Promise<StudentProfileUpdateResult> {
    const currentProfile = this.profileSignal();
    const nextPassword = profile.newPassword?.trim();
    let passwordUpdatedAt = currentProfile.passwordUpdatedAt;
    let errorMessage: string | undefined;

    if (nextPassword) {
      try {
        await firstValueFrom(
          this.backend.changePassword({
            email: currentProfile.email,
            password: nextPassword,
          }),
        );
        passwordUpdatedAt = 'Updated just now';
      } catch {
        errorMessage = 'Profile details were saved, but the new password could not be updated.';
      }
    }

    this.profileSignal.update((current) => ({
      ...current,
      idNumber: profile.idNumber,
      name: profile.name,
      email: profile.email,
      age: profile.age,
      contactNumber: profile.contactNumber,
      address: profile.address,
      profileImageDataUrl: profile.profileImageDataUrl ?? current.profileImageDataUrl,
      profileImageUrl: profile.profileImageUrl ?? current.profileImageUrl,
      passwordUpdatedAt,
    }));

    this.persistStudentSnapshot();
    return { success: !errorMessage, errorMessage };
  }

  updateMentorshipProfile(profile: StudentMentorshipProfile): Promise<boolean> {
    const nextProfile = {
      menteeName: profile.menteeName.trim(),
      menteeSurname: profile.menteeSurname.trim(),
      menteeJobTitle: profile.menteeJobTitle.trim(),
      menteeQualification: profile.menteeQualification.trim(),
      menteeExperience: profile.menteeExperience.trim(),
      mentorName: profile.mentorName.trim(),
      mentorSurname: profile.mentorSurname.trim(),
      mentorJobTitle: profile.mentorJobTitle.trim(),
      mentorQualification: profile.mentorQualification.trim(),
      mentorExperience: profile.mentorExperience.trim(),
    };

    this.mentorshipProfileSignal.set(nextProfile);
    this.saveMentorshipProfile(nextProfile);
    return this.persistStudentSnapshot();
  }

  updateMentorshipObjectives(objectives: StudentMentorshipObjectives): Promise<boolean> {
    const nextObjectives = {
      mentorshipGoals: objectives.mentorshipGoals
        .map((goal) => ({
          title: goal.title.trim(),
          date: goal.date,
          achievementDate: goal.achievementDate,
        }))
        .filter((goal) => goal.title || goal.date || goal.achievementDate),
      objectives: objectives.objectives
        .map((objective) => ({
          title: objective.title.trim(),
          date: objective.date,
          achievementDate: objective.achievementDate,
        }))
        .filter((objective) => objective.title || objective.date || objective.achievementDate),
    };

    this.mentorshipObjectivesSignal.set(nextObjectives);
    this.saveMentorshipObjectives(nextObjectives);
    return this.persistStudentSnapshot();
  }

  updateMentorshipProgressReport(report: StudentMentorshipProgressReport): Promise<boolean> {
    const nextReport = {
      dateOfMeeting: report.dateOfMeeting,
      objectivesAchieved: report.objectivesAchieved
        .map((entry) => ({
          objectiveAchieved: entry.objectiveAchieved.trim(),
          dateAchieved: entry.dateAchieved,
        }))
        .filter((entry) => entry.objectiveAchieved || entry.dateAchieved),
      mentorComments: report.mentorComments.trim(),
    };

    this.mentorshipProgressReportSignal.set(nextReport);
    this.saveMentorshipProgressReport(nextReport);
    return this.persistStudentSnapshot();
  }

  updateNotificationPreferences(preferences: StudentNotificationPreferences): StudentProfileUpdateResult {
    this.settingsSignal.update((current) => ({
      ...current,
      notificationPreferences: {
        emailUpdates: preferences.emailUpdates,
        smsAlerts: preferences.smsAlerts,
        assignmentReminders: preferences.assignmentReminders,
        messageNotifications: preferences.messageNotifications,
        certificateMilestones: preferences.certificateMilestones,
      },
    }));
    this.persistStudentSnapshot();
    return { success: true };
  }

  updatePrivacySettings(settings: StudentPrivacySettings): StudentProfileUpdateResult {
    this.settingsSignal.update((current) => ({
      ...current,
      privacySettings: {
        tutorProfileVisibility: settings.tutorProfileVisibility,
        classmateProfileVisibility: settings.classmateProfileVisibility,
        showEmailAddress: settings.showEmailAddress,
        showContactNumber: settings.showContactNumber,
      },
    }));
    this.persistStudentSnapshot();
    return { success: true };
  }

  async updateThemePreference(themePreference: LmsBrandThemeId): Promise<StudentProfileUpdateResult> {
    this.settingsSignal.update((current) => ({
      ...current,
      themePreference,
    }));
    const saved = await this.persistStudentSnapshot();
    return saved
      ? { success: true }
      : { success: false, errorMessage: 'Your theme could not be saved. Please check your connection and try again.' };
  }

  openCalendarEvent(event: StudentCalendarEvent) {
    if (!event.courseName) {
      return;
    }

    this.courseNavigationRequestSignal.set({
      courseName: event.courseName,
      offeringId: event.offeringId,
      stepId: event.stepId,
    });
  }

  clearCourseNavigationRequest() {
    this.courseNavigationRequestSignal.set(null);
  }

  markNotificationsRead() {
    this.notificationsSignal.update((items) => items.map((item) => ({ ...item, unread: false })));
    this.persistStudentSnapshot();
  }

  dismissNotification(id: string) {
    this.notificationsSignal.update((items) =>
      items.map((item) => item.id === id ? { ...item, dismissed: true, unread: false } : item),
    );
    this.persistStudentSnapshot();
  }

  markMessagesRead() {
    this.messagesSignal.update((items) => items.map((item) => ({ ...item, unread: false })));
    this.persistStudentSnapshot();
  }

  markMessageRead(messageId: string) {
    this.messagesSignal.update((items) =>
      items.map((item) =>
        item.id === messageId
          ? {
              ...item,
              unread: false,
            }
          : item,
      ),
    );

    this.persistStudentSnapshot();
  }

  sendMessage(recipient: string, subject: string, message: string) {
    const normalizedRecipient = recipient.trim();
    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();

    if (!normalizedRecipient || !normalizedSubject || !normalizedMessage) {
      return;
    }

    this.messagesSignal.update((items) => [
      {
        id: `student-message-${Date.now()}`,
        sender: `To: ${normalizedRecipient}`,
        subject: normalizedSubject,
        preview: normalizedMessage,
        body: normalizedMessage,
        time: 'Just now',
        unread: false,
        replies: [],
      },
      ...items,
    ]);

    this.persistStudentSnapshot();
    this.deliverMessageToManagerInbox(normalizedRecipient, normalizedSubject, normalizedMessage);
  }

  replyToMessage(messageId: string, message: string) {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      return;
    }

    this.messagesSignal.update((items) =>
      items.map((item) =>
        item.id === messageId
          ? {
              ...item,
              replies: [
                ...item.replies,
                {
                  id: `${messageId}-reply-${Date.now()}`,
                  sender: 'You',
                  body: normalizedMessage,
                  time: 'Just now',
                  authorType: 'student',
                  deliveryState: 'Sent',
                },
              ],
            }
          : item,
      ),
    );

    this.persistStudentSnapshot();

    // Deliver student reply to the manager inbox so the manager can see it.
    const originalMessage = this.messagesSignal().find((m) => m.id === messageId);
    if (originalMessage) {
      const recipientName = originalMessage.sender.startsWith('To: ')
        ? originalMessage.sender.slice(4).trim()
        : originalMessage.sender.trim();
      this.deliverReplyToManagerInbox(messageId, recipientName, originalMessage.subject, normalizedMessage);
    }
  }

  private deliverMessageToManagerInbox(recipient: string, subject: string, message: string) {
    const normalizedRecipient = recipient.trim().toLocaleLowerCase();
    const matchedManager = this.managerData.trainingManagers().find((manager) => {
      return manager.name.trim().toLocaleLowerCase() === normalizedRecipient;
    });

    if (!matchedManager) {
      return;
    }

    const senderName = this.profile().name || 'Learner';
    const inboxMessage: ManagerMessage = {
      id: `manager-message-${Date.now()}`,
      sender: senderName,
      subject,
      preview: message,
      body: message,
      time: 'Just now',
      unread: true,
      replies: [],
    };

    this.backend.postManagerMessage(inboxMessage).subscribe({
      error: () => {
        // Ignore delivery failures — student sent record is already persisted.
      },
    });
  }

  private deliverReplyToManagerInbox(messageId: string, recipient: string, subject: string, message: string) {
    const normalizedSubject = subject.trim().toLocaleLowerCase();
    const senderName = this.profile().name || 'Learner';
    const normalizedSender = senderName.trim().toLocaleLowerCase();

    this.backend.getManagerMessages().subscribe({
      next: (allMessages) => {
        // Match the manager thread by subject and sender (the student's name).
        const threadIndex = allMessages.findIndex(
          (m) =>
            m.subject.trim().toLocaleLowerCase() === normalizedSubject &&
            m.sender.trim().toLocaleLowerCase() === normalizedSender,
        );

        if (threadIndex === -1) {
          return;
        }

        const thread = allMessages[threadIndex];
        const reply: ManagerMessageReply = {
          id: `${thread.id}-reply-${Date.now()}`,
          sender: senderName,
          body: message,
          time: 'Just now',
          authorType: 'contact',
          deliveryState: 'Delivered',
        };

        const updatedMessages = allMessages.map((m, i) =>
          i === threadIndex ? { ...m, unread: true, replies: [...m.replies, reply] } : m,
        );

        this.backend.patchManagerState({ managerMessages: updatedMessages }).subscribe({
          error: () => {
            // Non-critical — student reply is already recorded locally.
          },
        });
      },
      error: () => {
        // Ignore — student reply is already recorded locally.
      },
    });
  }

  advanceCourseProgress(courseName: string, step = 10) {
    this.coursesSignal.update((courses) =>
      courses.map((course) => {
        if (course.name !== courseName || course.completed) {
          return course;
        }

        const nextProgress = Math.min(100, (course.progress ?? 0) + step);
        const nextCompleted = nextProgress >= 100;
        return {
          ...course,
          progress: nextProgress,
          completed: nextCompleted,
          completedAt: nextCompleted ? (course.completedAt ?? this.createCompletionDateStamp()) : course.completedAt,
        };
      }),
    );

    this.recordCourseEngagement();
    this.persistStudentSnapshot();
  }

  syncCourseProgress(courseName: string, progress: number) {
    const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));
    let updatedCourse: StudentCourse | null = null;

    this.coursesSignal.update((courses) =>
      courses.map((course) => {
        if (course.name !== courseName) {
          return course;
        }

        const nextProgress = Math.max(course.progress ?? 0, normalizedProgress);
        const nextCompleted = course.completed || nextProgress >= 100;
        const nextCompletedAt = nextCompleted ? (course.completedAt ?? this.createCompletionDateStamp()) : course.completedAt;

        if ((course.progress ?? 0) === nextProgress && course.completed === nextCompleted && course.completedAt === nextCompletedAt) {
          updatedCourse = course;
          return course;
        }

        updatedCourse = {
          ...course,
          progress: nextProgress,
          completed: nextCompleted,
          completedAt: nextCompletedAt,
        };
        return updatedCourse;
      }),
    );

    if (updatedCourse) {
      this.recordCourseEngagement();
      this.persistStudentSnapshot();
    }

    return updatedCourse;
  }

  completeCourse(courseName: string) {
    this.coursesSignal.update((courses) =>
      courses.map((course) =>
        course.name === courseName
          ? {
              ...course,
              progress: 100,
              completed: true,
              completedAt: course.completedAt ?? this.createCompletionDateStamp(),
            }
          : course,
      ),
    );

    this.recordCourseEngagement();
    this.persistStudentSnapshot();
  }

  recordAssessmentAttempt(assessmentKey: string, attempt: StudentAssessmentAttempt) {
    const normalizedKey = assessmentKey.trim();
    if (!normalizedKey) {
      return;
    }

    this.assessmentAttemptsSignal.update((current) => ({
      ...current,
      [normalizedKey]: attempt,
    }));

    this.persistStudentSnapshot();
  }

  /** Returns whether the backend write actually succeeded (or true if there was nothing to send
   *  to the backend yet), so callers that need to tell the user a save failed — rather than
   *  silently keeping the local-only copy — can await this instead of firing and forgetting. */
  private persistStudentSnapshot(): Promise<boolean> {
    const studentId = this.currentSessionStudentId();
    const persistedSnapshot = this.buildPersistedStudentSnapshot(studentId);

    if (this.studentStateHydrated) {
      this.savePersistedStudentSnapshot(persistedSnapshot);
    }

    // Never write to the shared default student — only ever write to a session's own,
    // real studentId. Without a real one, this is a stale/incomplete session (e.g. an
    // elevated account whose linked student profile hasn't resolved yet); saving here
    // would silently overwrite whichever real student the server treats as its default.
    if (!this.readSessionOwnStudentId()) {
      return Promise.resolve(true);
    }

    if (!this.backendHydrated) {
      return Promise.resolve(true);
    }

    const { studentId: _studentId, ...snapshotUpdate } = persistedSnapshot;
    const snapshotUpdateForBackend = {
      ...snapshotUpdate,
      // Strip the bulky base64 blob from backend writes once a Firebase Storage URL exists for
      // it — but never null it out if it's the only copy of the picture we have, or an unrelated
      // save (e.g. an autosave triggered while browsing courses) would silently delete it.
      profile: {
        ...snapshotUpdate.profile,
        profileImageDataUrl: snapshotUpdate.profile.profileImageUrl ? null : snapshotUpdate.profile.profileImageDataUrl,
      },
      certificatesAndLicences: snapshotUpdate.certificatesAndLicences.map((record) => ({
        ...record,
        fileDataUrl: '',
      })),
    };
    this.pendingSnapshotWriteCount += 1;

    return new Promise((resolve) => {
      this.backend.updateStudentSnapshot(snapshotUpdateForBackend, studentId).subscribe({
        next: () => {
          this.pendingSnapshotWriteCount = Math.max(0, this.pendingSnapshotWriteCount - 1);
          resolve(true);
        },
        error: () => {
          this.pendingSnapshotWriteCount = Math.max(0, this.pendingSnapshotWriteCount - 1);
          // Keep local state if the API is temporarily unavailable — but tell the caller so it
          // can warn the user instead of assuming the save reached the server.
          resolve(false);
        },
      });
    });
  }

  private createCompletionDateStamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private refreshStudentSnapshot(force = false) {
    if (this.refreshInFlight || (!force && this.pendingSnapshotWriteCount > 0)) {
      return;
    }

    const studentId = this.currentSessionStudentId();
    this.refreshInFlight = true;
    this.backend.getStudentSnapshot(studentId).subscribe({
      next: (snapshot) => {
        const localProfile = this.profileSignal();
        const mergedProfile: StudentProfileData = {
          ...snapshot.profile,
          // Local profile image (URL or legacy base64) is always authoritative —
          // the backend stores profileImageUrl but clears profileImageDataUrl on write.
          profileImageDataUrl: localProfile.profileImageDataUrl || snapshot.profile.profileImageDataUrl,
          profileImageUrl: localProfile.profileImageUrl || snapshot.profile.profileImageUrl || null,
        };

        // Merge unread state: local is authoritative for read state.
        // If local entry exists, always use its unread value (prevents server stale data
        // from either re-showing dismissed notifications or hiding unread ones on refresh).
        // If no local entry (new notification from server), use server value as-is.
        const localNotificationsById = new Map(this.notificationsSignal().map((n) => [n.id, n]));
        const mergedNotifications = this.dedupeNotifications(snapshot.notifications).map((serverNotif) => {
          const local = localNotificationsById.get(serverNotif.id);
          if (!local) return serverNotif;
          // Preserve local unread AND dismissed state — local is always authoritative for both.
          return { ...serverNotif, unread: local.unread, dismissed: local.dismissed };
        });

        const localMessagesById = new Map(this.messagesSignal().map((m) => [m.id, m]));
        const mergedMessages = snapshot.messages.map((serverMsg) => {
          const local = localMessagesById.get(serverMsg.id);
          if (!local) return serverMsg; // brand-new thread from manager — keep server's unread: true
          // Preserve local unread state and any local replies not yet reflected on the server.
          const serverReplyIds = new Set(serverMsg.replies.map((r) => r.id));
          const localPendingReplies = (local.replies ?? []).filter((r) => !serverReplyIds.has(r.id));
          // Re-mark as unread if the manager added new replies that the student hasn't seen locally yet.
          const localReplyIds = new Set((local.replies ?? []).map((r) => r.id));
          const hasNewIncomingReplies = serverMsg.replies.some(
            (r) => !localReplyIds.has(r.id) && r.authorType === 'contact',
          );
          const unread = hasNewIncomingReplies || local.unread;
          return { ...serverMsg, unread, replies: [...serverMsg.replies, ...localPendingReplies] };
        });

        // Retain local messages not yet reflected in the server snapshot (e.g., sent but not yet
        // persisted). Without this, locally-added messages get wiped on the next poll cycle.
        const mergedMessageIds = new Set(mergedMessages.map((m) => m.id));
        const localPendingMessages = this.messagesSignal().filter((m) => !mergedMessageIds.has(m.id));
        const allMergedMessages = [...mergedMessages, ...localPendingMessages];

        // Merge course progress: local is authoritative if it is equal or ahead of the server.
        // This prevents the 10-second polling refresh from overwriting progress the student
        // just made before the backend write has been reflected in a subsequent read.
        const localCoursesById = new Map(
          this.coursesSignal().map((c) => [c.offeringId ?? c.name, c]),
        );
        const mergedCourses = this.filterLegacySeedCourses(snapshot.courses).map((serverCourse) => {
          const key = serverCourse.offeringId ?? serverCourse.name;
          const local = localCoursesById.get(key);
          if (!local) return serverCourse;
          const localProgress = local.progress ?? 0;
          const serverProgress = serverCourse.progress ?? 0;
          // Keep local state when local is at least as far ahead (or completed)
          if (local.completed || localProgress >= serverProgress) {
            return { ...serverCourse, progress: local.progress, completed: local.completed, completedAt: local.completedAt };
          }
          return serverCourse;
        });

        // Retain local courses not yet reflected in the server snapshot (e.g., added by the
        // offering-sync effect but whose persistStudentSnapshot write is still in-flight).
        // Without this, courses flicker: added locally → refresh drops them → effect re-adds them.
        const mergedCourseKeys = new Set(mergedCourses.map((c) => c.offeringId ?? c.name));
        const localPendingCourses = this.filterLegacySeedCourses(this.coursesSignal())
          .filter((c) => !mergedCourseKeys.has(c.offeringId ?? c.name));
        const allMergedCourses = [...mergedCourses, ...localPendingCourses];

        // Merge notifiedOfferingIds as a union so that locally-tracked offerings are not
        // overwritten by a stale server value, which would re-trigger course notifications.
        const localNotifiedIds = this.notifiedOfferingIdsSignal();
        const serverNotifiedIds = snapshot.notifiedOfferingIds ?? [];
        const mergedNotifiedIds = [...new Set([...localNotifiedIds, ...serverNotifiedIds])];

        const localCertificates = this.certificatesAndLicencesSignal();
        const localCertificateIds = new Set(localCertificates.map((record) => record.id));
        const mergedCertificates = [
          ...localCertificates,
          ...(snapshot.certificatesAndLicences ?? []).filter((record) => !localCertificateIds.has(record.id)),
        ];

        const nextSnapshot: PersistedStudentSnapshot = {
          studentId,
          profile: mergedProfile,
          badgeState: { earnedBadgeIds: snapshot.badgeState.earnedBadgeIds },
          certificatesAndLicences: mergedCertificates,
          settings: snapshot.settings,
          mentorshipProfile: snapshot.mentorshipProfile,
          mentorshipObjectives: snapshot.mentorshipObjectives,
          mentorshipProgressReport: snapshot.mentorshipProgressReport,
          courses: allMergedCourses,
          notifications: mergedNotifications,
          messages: allMergedMessages,
          notifiedOfferingIds: mergedNotifiedIds,
          assessmentAttempts: snapshot.assessmentAttempts ?? {},
          // Local engagement state is always authoritative — never let a backend refresh overwrite it.
          engagementState: this.engagementSignal(),
        };

        // Discard stale response if the session switched while this request was in-flight.
        // Without this guard, Student A's backend response can overwrite Student B's signals
        // when accounts are switched before the HTTP request completes.
        if (studentId !== this.currentSessionStudentId()) {
          this.refreshInFlight = false;
          return;
        }

        this.applyPersistedStudentState(nextSnapshot);
        this.studentStateHydrated = true;

        this.backendHydrated = true;
        this.refreshInFlight = false;

        if (nextSnapshot.notifications.length !== snapshot.notifications.length) {
          this.persistStudentSnapshot();
        }
      },
      error: () => {
        // Discard stale error if the session switched while this request was in-flight.
        if (studentId !== this.currentSessionStudentId()) {
          this.refreshInFlight = false;
          return;
        }

        if (!this.studentStateHydrated) {
          this.resetStudentStateForCurrentSession();
        }

        this.studentStateHydrated = true;
        this.savePersistedStudentSnapshot(this.buildPersistedStudentSnapshot(studentId));
        this.backendHydrated = true;
        this.refreshInFlight = false;
      },
    });
  }

  private currentSessionStudentId() {
    return this.readSessionOwnStudentId() ?? this.backend.defaultStudentId;
  }

  /** The session's own real studentId, or null if it doesn't have one yet (e.g. a stale
   *  session issued before an elevated account was linked to its own student profile).
   *  Distinct from currentSessionStudentId(), which falls back to the shared default
   *  student for *reads* — that fallback must never be used as a target for *writes*,
   *  or a session with no real studentId would silently overwrite a real student's data. */
  private readSessionOwnStudentId(): string | null {
    try {
      const session = JSON.parse(localStorage.getItem('lms-session') || '{}') as { studentId?: string | null };
      if (typeof session.studentId === 'string' && session.studentId.trim()) {
        return session.studentId.trim();
      }
    } catch {
      // Ignore malformed session state.
    }

    return null;
  }

  private applyPersistedStudentStateForCurrentSession() {
    const persistedSnapshot = this.loadPersistedStudentSnapshot();

    if (persistedSnapshot) {
      this.applyPersistedStudentState(persistedSnapshot);
      this.studentStateHydrated = true;
      return;
    }

    this.resetStudentStateForCurrentSession();
    this.studentStateHydrated = false;
  }

  private applyPersistedStudentState(snapshot: PersistedStudentSnapshot) {
    this.profileSignal.set(snapshot.profile);
    this.settingsSignal.set(snapshot.settings);
    this.mentorshipProfileSignal.set(snapshot.mentorshipProfile);
    this.mentorshipObjectivesSignal.set(snapshot.mentorshipObjectives);
    this.mentorshipProgressReportSignal.set(snapshot.mentorshipProgressReport);
    this.coursesSignal.set(this.filterLegacySeedCourses(snapshot.courses));
    this.certificatesAndLicencesSignal.set(snapshot.certificatesAndLicences);
    this.assessmentAttemptsSignal.set(snapshot.assessmentAttempts);
    this.notificationsSignal.set(snapshot.notifications);
    this.messagesSignal.set(snapshot.messages);
    this.persistedEarnedBadgeIdsSignal.set(snapshot.badgeState.earnedBadgeIds);
    this.notifiedOfferingIdsSignal.set(snapshot.notifiedOfferingIds);
    this.engagementSignal.set(snapshot.engagementState ?? { streakDays: 0, lastEngagedDate: '' });

    this.saveMentorshipProfile(snapshot.mentorshipProfile);
    this.saveMentorshipObjectives(snapshot.mentorshipObjectives);
    this.saveMentorshipProgressReport(snapshot.mentorshipProgressReport);
    this.savePersistedBadgeIds(snapshot.badgeState.earnedBadgeIds);
    this.saveNotifiedOfferingIds(snapshot.notifiedOfferingIds);
    this.savePersistedStudentSnapshot(snapshot);
  }

  private resetStudentStateForCurrentSession() {
    this.profileSignal.set(this.createInitialProfile());
    this.settingsSignal.set(this.createInitialSettings());
    this.mentorshipProfileSignal.set(this.createInitialMentorshipProfile());
    this.mentorshipObjectivesSignal.set(this.createInitialMentorshipObjectives());
    this.mentorshipProgressReportSignal.set(this.createInitialMentorshipProgressReport());
    this.coursesSignal.set([]);
    this.certificatesAndLicencesSignal.set([]);
    this.assessmentAttemptsSignal.set({});
    this.notificationsSignal.set(this.createInitialNotifications());
    this.messagesSignal.set(this.createInitialMessages());
    this.persistedEarnedBadgeIdsSignal.set(this.loadPersistedBadgeIds());
    this.notifiedOfferingIdsSignal.set(this.loadNotifiedOfferingIds(this.managerData.offerings()));
    this.engagementSignal.set({ streakDays: 0, lastEngagedDate: '' });
  }

  private buildPersistedStudentSnapshot(studentId = this.currentSessionStudentId()): PersistedStudentSnapshot {
    return {
      studentId,
      profile: this.profileSignal(),
      badgeState: { earnedBadgeIds: this.persistedEarnedBadgeIdsSignal() },
      certificatesAndLicences: this.certificatesAndLicencesSignal(),
      settings: this.settingsSignal(),
      mentorshipProfile: this.mentorshipProfileSignal(),
      mentorshipObjectives: this.mentorshipObjectivesSignal(),
      mentorshipProgressReport: this.mentorshipProgressReportSignal(),
      courses: this.coursesSignal(),
      notifications: this.notificationsSignal(),
      messages: this.messagesSignal(),
      notifiedOfferingIds: this.notifiedOfferingIdsSignal(),
      assessmentAttempts: this.assessmentAttemptsSignal(),
      engagementState: this.engagementSignal(),
    };
  }

  // Local calendar date (not UTC) — using toISOString() here would shift the "day" for any
  // student whose local timezone isn't UTC, silently breaking the streak around midnight.
  private toLocalDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private todayDateString() {
    return this.toLocalDateString(new Date());
  }

  private yesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.toLocalDateString(d);
  }

  /**
   * Records that the student has engaged with a course today.
   * Increments the streak if they engaged yesterday as well, otherwise starts a new streak of 1.
   * Calling this multiple times on the same calendar day is a no-op after the first call.
   */
  private recordCourseEngagement() {
    const today = this.todayDateString();
    this.engagementSignal.update((state) => {
      if (state.lastEngagedDate === today) return state; // already counted today
      const yesterday = this.yesterdayDateString();
      const newStreak = state.lastEngagedDate === yesterday ? state.streakDays + 1 : 1;
      return { streakDays: newStreak, lastEngagedDate: today };
    });
  }

  private learningStreakDays() {
    return this.currentEngagementStreak();
  }

  private isBadgeEarnedByRules(
    badgeId: string,
    completedCourses: StudentCourse[],
    learningStreakDays: number,
    fastFinisherEarnedOn: string | null,
  ) {
    if (badgeId === 'fast-finisher') {
      return fastFinisherEarnedOn !== null;
    }

    if (badgeId === 'consistency-star') {
      return learningStreakDays >= 7;
    }

    if (badgeId === 'induction-complete') {
      return completedCourses.some((course) => course.name === 'Company Induction');
    }

    if (badgeId === 'respect-at-work') {
      return completedCourses.some((course) => course.name === 'Sexual Harassment In The Workplace');
    }

    return false;
  }

  private resolveEarnedDate(badgeId: string, fastFinisherEarnedOn: string | null) {
    if (badgeId === 'consistency-star') {
      return 'April 2026';
    }

    if (badgeId === 'induction-complete') {
      return 'April 2026';
    }

    if (badgeId === 'fast-finisher') {
      return fastFinisherEarnedOn ?? 'Recently earned';
    }

    if (badgeId === 'respect-at-work') {
      return 'Pending review';
    }

    return 'Recently earned';
  }

  private fastFinisherEarnedOn() {
    const currentStudentId = this.currentSessionStudentId();
    const deadlineByOfferingId = new Map(
      this.managerData.offerings().map((offering) => [offering.id, this.parseCalendarDate(offering.completionDeadline)]),
    );

    const submissions = this.managerData.assignmentSubmissions()
      .filter((submission) => submission.studentId === currentStudentId)
      .map((submission) => ({
        submittedAt: this.parseCalendarDate(submission.submittedAt),
        deadline: deadlineByOfferingId.get(submission.offeringId) ?? null,
      }))
      .filter((submission): submission is { submittedAt: Date; deadline: Date } => submission.submittedAt !== null && submission.deadline !== null)
      .sort((left, right) => left.submittedAt.getTime() - right.submittedAt.getTime());

    let earlyCompletionStreak = 0;

    for (const submission of submissions) {
      if (submission.submittedAt.getTime() <= submission.deadline.getTime()) {
        earlyCompletionStreak += 1;

        if (earlyCompletionStreak >= 3) {
          return this.formatBadgeEarnedMonth(submission.submittedAt);
        }

        continue;
      }

      earlyCompletionStreak = 0;
    }

    return null;
  }

  private formatBadgeEarnedMonth(date: Date) {
    return new Intl.DateTimeFormat('en-ZA', {
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private persistBadgeUnlock(badgeId: string) {
    const current = this.persistedEarnedBadgeIdsSignal();
    if (current.includes(badgeId)) {
      return;
    }

    const next = [...current, badgeId];
    this.persistedEarnedBadgeIdsSignal.set(next);
    this.savePersistedBadgeIds(next);
    this.persistStudentSnapshot();
  }

  private syncPublishedOfferingsToLearnerCourses(publishedOfferings: TrainingOffering[]) {
    this.coursesSignal.update((courses) => {
      const publishedOfferingIds = new Set(publishedOfferings.map((offering) => offering.id));
      const publishedOfferingTitles = new Set(publishedOfferings.map((offering) => offering.title));
      const retainedCourses = courses.filter((course) =>
        course.offeringId
          ? publishedOfferingIds.has(course.offeringId)
          : publishedOfferingTitles.has(course.name),
      );
      const courseByOfferingId = new Map(retainedCourses.filter((course) => course.offeringId).map((course) => [course.offeringId!, course]));
      const courseByName = new Map(retainedCourses.map((course) => [course.name, course]));
      const newCourses: StudentCourse[] = [];
      let hasExistingUpdates = retainedCourses.length !== courses.length;

      const updatedExistingCourses = retainedCourses.map((course) => {
        const matchedOffering = course.offeringId
          ? publishedOfferings.find((offering) => offering.id === course.offeringId)
          : publishedOfferings.find((offering) => offering.title === course.name);

        if (!matchedOffering) {
          return course;
        }

        const nextImage = matchedOffering.thumbnailDataUrl || course.image || this.defaultCourseImage();
        const nextDescription = matchedOffering.description || course.description;

        if (course.offeringId === matchedOffering.id && course.name === matchedOffering.title && course.image === nextImage && course.description === nextDescription) {
          return course;
        }

        hasExistingUpdates = true;
        return {
          ...course,
          offeringId: matchedOffering.id,
          name: matchedOffering.title,
          image: nextImage,
          description: nextDescription,
        };
      });

      for (const offering of publishedOfferings) {
        if (courseByOfferingId.has(offering.id) || courseByName.has(offering.title)) {
          continue;
        }

        newCourses.push({
          offeringId: offering.id,
          name: offering.title,
          progress: 0,
          image: offering.thumbnailDataUrl || this.defaultCourseImage(),
          completed: false,
          description: offering.description,
        });
      }

      if (!newCourses.length && !hasExistingUpdates) {
        return courses;
      }

      return [...newCourses, ...updatedExistingCourses];
    });
  }

  private pruneRemovedOfferingNotifications(publishedOfferingIds: string[]) {
    // Skip pruning when the list is empty — this is almost always a race condition where
    // student assignment data hasn't loaded yet, not a genuine removal of all offerings.
    if (!publishedOfferingIds.length) {
      return;
    }

    const activeOfferingIds = new Set(publishedOfferingIds);

    this.notificationsSignal.update((items) => {
      const nextItems = items.filter(
        (item) =>
          item.dismissed || // Never remove dismissed notifications — they guard against re-creation
          !item.id.startsWith('course-') ||
          activeOfferingIds.has(item.id.slice('course-'.length)),
      );
      return nextItems.length === items.length ? items : nextItems;
    });
  }

  private pruneRemovedOfferingAssessmentAttempts(publishedOfferings: TrainingOffering[]) {
    const validOfferingKeys = new Set(publishedOfferings.flatMap((offering) => [offering.id, offering.title]));

    this.assessmentAttemptsSignal.update((attempts) => {
      const nextEntries = Object.entries(attempts).filter(([assessmentKey]) => {
        const [offeringKey] = assessmentKey.split('::');
        return validOfferingKeys.has(offeringKey);
      });

      return nextEntries.length === Object.keys(attempts).length ? attempts : Object.fromEntries(nextEntries);
    });
  }

  private filterLegacySeedCourses(courses: StudentCourse[]) {
    return courses.filter((course) => !StudentDataService.legacySeedCourseTitles.has(course.name));
  }

  private addNotificationsForNewOfferings(publishedOfferings: TrainingOffering[], knownNotifiedIds: string[]) {
    const newOfferings = publishedOfferings.filter((offering) => !knownNotifiedIds.includes(offering.id));

    if (!newOfferings.length) {
      return;
    }

    this.notificationsSignal.update((items) => {
      const existingNotificationIds = new Set(items.map((item) => item.id));
      const dismissedNotificationIds = new Set(items.filter((n) => n.dismissed).map((n) => n.id));
      const nextNotifications = newOfferings
        .filter((offering) => !existingNotificationIds.has(`course-${offering.id}`) && !dismissedNotificationIds.has(`course-${offering.id}`))
        .map((offering) => ({
          id: `course-${offering.id}`,
          badge: 'Course',
          title: 'New course available',
          body: `${offering.title} has been loaded to your learner profile and is ready to open.`,
          dateLabel: 'Just now',
          createdAt: new Date().toISOString(),
          unread: true,
        } satisfies StudentNotification));

      if (!nextNotifications.length) {
        return items;
      }

      return [...nextNotifications, ...items];
    });
  }

  private dedupeNotifications(notifications: StudentNotification[]) {
    const seenIds = new Set<string>();

    return notifications.filter((notification) => {
      if (seenIds.has(notification.id)) {
        return false;
      }

      seenIds.add(notification.id);
      return true;
    });
  }

  private haveOfferingIdsChanged(currentIds: string[], nextIds: string[]) {
    if (currentIds.length !== nextIds.length) {
      return true;
    }

    return currentIds.some((id, index) => id !== nextIds[index]);
  }

  private buildCalendarEvents(courses: StudentCourse[], offerings: TrainingOffering[]) {
    const events = courses.flatMap((course) => {
      const offering = course.offeringId
        ? offerings.find((candidate) => candidate.id === course.offeringId)
        : offerings.find((candidate) => candidate.title === course.name);

      if (!offering) {
        return [];
      }

      const deadline = this.parseCalendarDate(offering.completionDeadline);
      if (!deadline) {
        return [];
      }

      return offering.contentItems.flatMap((item, itemIndex) => {
        if (item.kind !== 'Assessment' || item.assessmentType !== 'Assignment') {
          return [];
        }

        const title = item.title?.trim() || `${offering.title} assignment`;
        return [{
          id: `${offering.id}-${item.id || `assignment-${itemIndex + 1}`}-deadline`,
          date: deadline,
          title: `Deadline reminder: ${title}`,
          courseName: course.name,
          offeringId: offering.id,
          stepId: item.id || `${offering.id}-assessment-${itemIndex + 1}`,
          actionLabel: 'Open in Courses',
        } satisfies StudentCalendarEvent];
      });
    });

    return events.sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  private calculateCourseMinutesSpent(course: StudentCourse, offerings: TrainingOffering[]) {
    const estimatedCourseMinutes = this.estimateCourseDurationMinutes(course, offerings);
    const progressRatio = Math.max(0, Math.min(100, course.completed ? 100 : (course.progress ?? 0))) / 100;

    return Math.round(estimatedCourseMinutes * progressRatio);
  }

  private estimateCourseDurationMinutes(course: StudentCourse, offerings: TrainingOffering[]) {
    const matchedOffering = course.offeringId
      ? offerings.find((offering) => offering.id === course.offeringId)
      : offerings.find((offering) => offering.title === course.name);

    if (!matchedOffering?.contentItems.length) {
      return 20;
    }

    return matchedOffering.contentItems.reduce(
      (totalMinutes, item) => totalMinutes + this.estimateContentItemMinutes(item),
      0,
    );
  }

  private estimateContentItemMinutes(item: TrainingOffering['contentItems'][number]) {
    if (item.kind === 'Video') {
      // Use the video's real captured length when known, so "Total Hours Spent" reflects
      // this course's actual content instead of a flat guess for every video.
      if (typeof item.durationSeconds === 'number' && item.durationSeconds > 0) {
        return Math.max(1, Math.round(item.durationSeconds / 60));
      }
      return 20;
    }

    if (item.kind === 'Document') {
      return item.requiresAcknowledgement ? 10 : 8;
    }

    if (item.kind === 'Scorm') {
      return 20;
    }

    switch (item.assessmentType) {
      case 'Assignment':
        return 30;
      case 'Mentorship':
        return 25;
      case 'Read and Acknowledge':
        return 10;
      case 'Quiz':
      default:
        return 15;
    }
  }

  private formatTrainingHours(totalMinutes: number) {
    const hours = totalMinutes / 60;
    return hours >= 10 ? Math.round(hours) : Number(hours.toFixed(1));
  }

  private formatTrainingMinutes(totalMinutes: number) {
    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }

    const hours = totalMinutes / 60;
    return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)} hour${hours === 1 ? '' : 's'}`;
  }

  private parseCalendarDate(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const isoDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private loadPersistedBadgeIds() {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.studentScopedStorageKey(StudentDataService.badgesStorageKey));
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as StudentBadgeState;
      return Array.isArray(parsed.earnedBadgeIds) ? parsed.earnedBadgeIds : [];
    } catch {
      return [];
    }
  }

  private savePersistedBadgeIds(earnedBadgeIds: string[]) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: StudentBadgeState = { earnedBadgeIds };
    localStorage.setItem(this.studentScopedStorageKey(StudentDataService.badgesStorageKey), JSON.stringify(payload));
  }

  private loadNotifiedOfferingIds(currentOfferings: TrainingOffering[]) {
    if (typeof localStorage === 'undefined') {
      return currentOfferings.filter((offering) => offering.status === 'Published').map((offering) => offering.id);
    }

    try {
      const raw = localStorage.getItem(this.studentScopedStorageKey(StudentDataService.notifiedOfferingIdsStorageKey));
      if (!raw) {
        return currentOfferings.filter((offering) => offering.status === 'Published').map((offering) => offering.id);
      }

      const parsed = JSON.parse(raw) as { offeringIds?: string[] };
      return Array.isArray(parsed.offeringIds) ? parsed.offeringIds : [];
    } catch {
      return currentOfferings.filter((offering) => offering.status === 'Published').map((offering) => offering.id);
    }
  }

  private saveNotifiedOfferingIds(offeringIds: string[]) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.studentScopedStorageKey(StudentDataService.notifiedOfferingIdsStorageKey), JSON.stringify({ offeringIds }));
  }

  private createInitialProfile(studentId = this.currentSessionStudentId()): StudentProfileData {
    const student = this.managerData.students().find((item) => item.id === studentId);
    // Never fall back to a real seeded person's name/email here — if this placeholder is ever
    // persisted before the real snapshot loads (e.g. a hydration race), it must not overwrite
    // someone else's actual identity on the server.
    const defaultProfile: StudentProfileData = {
      name: '',
      email: '',
      idNumber: '',
      age: 19,
      contactNumber: '+27 71 555 0134',
      address: '24 Cedar Avenue, Johannesburg',
      department: 'General',
      jobTitle: 'Not set',
      joined: 'January 2026',
      learningStreak: '8 days',
      profileImageDataUrl: null,
      profileImageUrl: null,
      passwordUpdatedAt: 'Not updated yet',
    };

    if (!student) {
      return defaultProfile;
    }

    return {
      ...defaultProfile,
      name: `${student.name} ${student.surname}`,
      email: student.email,
      idNumber: student.idNumber || defaultProfile.idNumber,
      department: student.department || defaultProfile.department,
      jobTitle: student.jobTitle || defaultProfile.jobTitle,
      joined: student.dateEnrolled || defaultProfile.joined,
    };
  }

  private createInitialSettings(): StudentSettingsData {
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
      themePreference: 'ocean',
    };
  }

  private createInitialNotifications(): StudentNotification[] {
    return [
      {
        id: 'notification-welcome',
        badge: 'New',
        title: 'Welcome to SkillsConnect',
        body: 'Start your learning journey by exploring your assigned courses and upcoming milestones.',
        dateLabel: 'Just now',
        createdAt: new Date().toISOString(),
        unread: true,
      },
    ];
  }

  private createInitialMessages(): StudentMessage[] {
    return [];
  }

  private createInitialMentorshipProfile(): StudentMentorshipProfile {
    const { firstName, surname } = this.splitName(this.profileSignal().name);

    return {
      menteeName: firstName,
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

  private createInitialMentorshipObjectives(): StudentMentorshipObjectives {
    return {
      mentorshipGoals: [this.createEmptyMentorshipObjectiveEntry()],
      objectives: [this.createEmptyMentorshipObjectiveEntry()],
    };
  }

  private createEmptyMentorshipObjectiveEntry(): StudentMentorshipObjectiveEntry {
    return {
      title: '',
      date: '',
      achievementDate: '',
    };
  }

  private createInitialMentorshipProgressReport(): StudentMentorshipProgressReport {
    return {
      dateOfMeeting: '',
      objectivesAchieved: [
        {
          objectiveAchieved: '',
          dateAchieved: '',
        },
      ],
      mentorComments: '',
    };
  }

  private loadMentorshipProfile() {
    const fallbackProfile = this.createInitialMentorshipProfile();
    if (typeof localStorage === 'undefined') {
      return fallbackProfile;
    }

    try {
      const raw = localStorage.getItem(this.studentScopedStorageKey(StudentDataService.mentorshipProfileStorageKey));
      if (!raw) {
        return fallbackProfile;
      }

      const parsed = JSON.parse(raw) as Partial<StudentMentorshipProfile>;
      return {
        menteeName: parsed.menteeName?.trim() || fallbackProfile.menteeName,
        menteeSurname: parsed.menteeSurname?.trim() || fallbackProfile.menteeSurname,
        menteeJobTitle: parsed.menteeJobTitle?.trim() || '',
        menteeQualification: parsed.menteeQualification?.trim() || '',
        menteeExperience: parsed.menteeExperience?.trim() || '',
        mentorName: parsed.mentorName?.trim() || '',
        mentorSurname: parsed.mentorSurname?.trim() || '',
        mentorJobTitle: parsed.mentorJobTitle?.trim() || '',
        mentorQualification: parsed.mentorQualification?.trim() || '',
        mentorExperience: parsed.mentorExperience?.trim() || '',
      };
    } catch {
      return fallbackProfile;
    }
  }

  private saveMentorshipProfile(profile: StudentMentorshipProfile) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.studentScopedStorageKey(StudentDataService.mentorshipProfileStorageKey), JSON.stringify(profile));
  }

  private loadMentorshipObjectives() {
    const fallbackObjectives = this.createInitialMentorshipObjectives();
    if (typeof localStorage === 'undefined') {
      return fallbackObjectives;
    }

    try {
      const raw = localStorage.getItem(this.studentScopedStorageKey(StudentDataService.mentorshipObjectivesStorageKey));
      if (!raw) {
        return fallbackObjectives;
      }

      const parsed = JSON.parse(raw) as Partial<StudentMentorshipObjectives>;
      return {
        mentorshipGoals: Array.isArray(parsed.mentorshipGoals)
          ? parsed.mentorshipGoals
              .map((goal) => ({
                title: goal.title?.trim() || '',
                date: goal.date || '',
                achievementDate: goal.achievementDate || '',
              }))
              .filter((goal) => goal.title || goal.date || goal.achievementDate)
          : fallbackObjectives.mentorshipGoals,
        objectives: Array.isArray(parsed.objectives)
          ? parsed.objectives
              .map((objective) => ({
                title: objective.title?.trim() || '',
                date: objective.date || '',
                achievementDate: objective.achievementDate || '',
              }))
              .filter((objective) => objective.title || objective.date || objective.achievementDate)
          : fallbackObjectives.objectives,
      };
    } catch {
      return fallbackObjectives;
    }
  }

  private saveMentorshipObjectives(objectives: StudentMentorshipObjectives) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.studentScopedStorageKey(StudentDataService.mentorshipObjectivesStorageKey), JSON.stringify(objectives));
  }

  private loadMentorshipProgressReport() {
    const fallbackReport = this.createInitialMentorshipProgressReport();
    if (typeof localStorage === 'undefined') {
      return fallbackReport;
    }

    try {
      const raw = localStorage.getItem(this.studentScopedStorageKey(StudentDataService.mentorshipProgressReportStorageKey));
      if (!raw) {
        return fallbackReport;
      }

      const parsed = JSON.parse(raw) as Partial<StudentMentorshipProgressReport>;
      return {
        dateOfMeeting: parsed.dateOfMeeting || '',
        objectivesAchieved: Array.isArray(parsed.objectivesAchieved)
          ? parsed.objectivesAchieved
              .map((entry) => ({
                objectiveAchieved: entry.objectiveAchieved?.trim() || '',
                dateAchieved: entry.dateAchieved || '',
              }))
              .filter((entry) => entry.objectiveAchieved || entry.dateAchieved)
          : fallbackReport.objectivesAchieved,
        mentorComments: parsed.mentorComments?.trim() || '',
      };
    } catch {
      return fallbackReport;
    }
  }

  private saveMentorshipProgressReport(report: StudentMentorshipProgressReport) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.studentScopedStorageKey(StudentDataService.mentorshipProgressReportStorageKey), JSON.stringify(report));
  }

  private loadPersistedStudentSnapshot(studentId = this.currentSessionStudentId()) {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.studentSnapshotStorageKey(studentId));
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedStudentSnapshot>;
      if (!parsed.profile || !parsed.settings || !parsed.mentorshipProfile || !parsed.mentorshipObjectives || !parsed.mentorshipProgressReport) {
        return null;
      }

      if (!Array.isArray(parsed.courses) || !Array.isArray(parsed.notifications) || !Array.isArray(parsed.messages) || !Array.isArray(parsed.notifiedOfferingIds)) {
        return null;
      }

      return {
        studentId,
        profile: {
          ...(parsed.profile as StudentProfileData),
          // Normalize fields added after initial release so old localStorage snapshots
          // load cleanly without undefined values.
          profileImageUrl: (parsed.profile as StudentProfileData).profileImageUrl ?? null,
        },
        badgeState: {
          earnedBadgeIds: Array.isArray(parsed.badgeState?.earnedBadgeIds)
            ? parsed.badgeState.earnedBadgeIds.filter((badgeId): badgeId is string => typeof badgeId === 'string')
            : [],
        },
        certificatesAndLicences: Array.isArray(parsed.certificatesAndLicences)
          ? parsed.certificatesAndLicences.filter((record): record is StudentCertificateLicence =>
            typeof record?.id === 'string'
            && typeof record?.certificationName === 'string'
            && typeof record?.completionDate === 'string'
            && typeof record?.expiryDate === 'string'
            && typeof record?.fileName === 'string'
            && typeof record?.fileDataUrl === 'string'
            && (record?.status === 'Active' || record?.status === 'Expired' || record?.status === 'Pending Renewal')
            && (record?.renewalRequired === 'Yes' || record?.renewalRequired === 'No')
            && (record?.reminderNotification === 'Yes' || record?.reminderNotification === 'No')
            && typeof record?.reminderDaysBeforeExpiry === 'number'
          )
          : [],
        settings: parsed.settings as StudentSettingsData,
        mentorshipProfile: parsed.mentorshipProfile as StudentMentorshipProfile,
        mentorshipObjectives: parsed.mentorshipObjectives as StudentMentorshipObjectives,
        mentorshipProgressReport: parsed.mentorshipProgressReport as StudentMentorshipProgressReport,
        courses: this.filterLegacySeedCourses(parsed.courses as StudentCourse[]),
        notifications: this.dedupeNotifications(parsed.notifications as StudentNotification[]),
        messages: parsed.messages as StudentMessage[],
        notifiedOfferingIds: parsed.notifiedOfferingIds.filter((offeringId): offeringId is string => typeof offeringId === 'string'),
        assessmentAttempts: parsed.assessmentAttempts && typeof parsed.assessmentAttempts === 'object'
          ? parsed.assessmentAttempts as Record<string, StudentAssessmentAttempt>
          : {},
        engagementState: parsed.engagementState && typeof parsed.engagementState === 'object'
          ? parsed.engagementState as StudentEngagementState
          : { streakDays: 0, lastEngagedDate: '' },
      };
    } catch {
      return null;
    }
  }

  private savePersistedStudentSnapshot(snapshot: PersistedStudentSnapshot) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.studentSnapshotStorageKey(snapshot.studentId), JSON.stringify(snapshot));
    } catch {
      // Ignore storage write failures (for example quota limits) so backend sync can continue.
    }
  }

  private studentScopedStorageKey(baseKey: string, studentId = this.currentSessionStudentId()) {
    return `${baseKey}.${studentId}`;
  }

  private studentSnapshotStorageKey(studentId = this.currentSessionStudentId()) {
    return `${StudentDataService.studentSnapshotStorageKeyPrefix}.${studentId}`;
  }

  private splitName(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);

    return {
      firstName: parts[0] ?? '',
      surname: parts.slice(1).join(' '),
    };
  }

  private startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private defaultCourseImage() {
    return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80';
  }
}
