import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { LmsBackendService } from './lms-backend.service';
import { StudentDataService } from './student-data.service';

function createPersistedSnapshot(studentId: string, name: string, email: string, mentorName: string) {
  return {
    studentId,
    profile: {
      name,
      email,
      age: 28,
      contactNumber: '+27 82 000 0000',
      address: '10 Example Street',
      department: 'Operations',
      jobTitle: 'Not set',
      joined: '2026-03-01',
      learningStreak: '3 days',
      profileImageDataUrl: null,
      passwordUpdatedAt: 'Not updated yet',
    },
    badgeState: {
      earnedBadgeIds: studentId === 'student-1' ? ['consistency-star'] : ['fast-finisher'],
    },
    settings: {
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
      themePreference: studentId === 'student-1' ? 'ocean' : 'forest',
    },
    mentorshipProfile: {
      menteeName: name.split(' ')[0] ?? name,
      menteeSurname: name.split(' ').slice(1).join(' '),
      menteeJobTitle: 'Coordinator',
      menteeQualification: 'Diploma',
      menteeExperience: '2 years',
      mentorName,
      mentorSurname: 'Mentor',
      mentorJobTitle: 'Manager',
      mentorQualification: 'BCom',
      mentorExperience: '8 years',
    },
    mentorshipObjectives: {
      mentorshipGoals: [{ title: `${name} goal`, date: '2026-05-01', achievementDate: '' }],
      objectives: [{ title: `${name} objective`, date: '2026-05-02', achievementDate: '' }],
    },
    mentorshipProgressReport: {
      dateOfMeeting: '2026-05-03',
      objectivesAchieved: [{ objectiveAchieved: `${name} achieved`, dateAchieved: '2026-05-03' }],
      mentorComments: `${name} progress`,
    },
    courses: [{ offeringId: `${studentId}-course`, name: `${name} course`, progress: 55, image: '', completed: false, description: 'Tracked per student' }],
    notifications: [{ id: `${studentId}-notification`, badge: 'New', title: `${name} notification`, body: 'Student specific', dateLabel: 'Today', unread: true }],
    messages: [{ id: `${studentId}-message`, sender: mentorName, subject: `${name} subject`, preview: 'Student specific', body: 'Student specific message', time: '1 min ago', unread: true, replies: [] }],
    notifiedOfferingIds: [`${studentId}-course`],
    assessmentAttempts: {
      [`${studentId}-assessment`]: {
        attemptsUsed: 1,
        passed: true,
        lastScorePercentage: 80,
        lastScoreEarned: 8,
        lastScorePossible: 10,
        lastSubmittedAt: '03 May 2026',
      },
    },
  };
}

describe('StudentDataService per-student snapshot isolation', () => {
  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LmsBackendService,
          useValue: {
            defaultStudentId: 'student-1',
            getBootstrap: () => throwError(() => new Error('offline')),
            getStudentSnapshot: () => throwError(() => new Error('offline')),
            updateStudentSnapshot: () => of({}),
            patchManagerState: () => of({}),
            getMyIdentity: () => throwError(() => new Error('offline')),
          },
        },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads and switches student state by the logged-in student id', () => {
    const studentOneSnapshot = createPersistedSnapshot('student-1', 'Alice Johnson', 'alice.johnson@skillsconnect.app', 'Ava');
    const studentTwoSnapshot = createPersistedSnapshot('student-2', 'Brian Molefe', 'brian.molefe@skillsconnect.app', 'Theo');

    localStorage.setItem('lms-app.student-snapshot.student-1', JSON.stringify(studentOneSnapshot));
    localStorage.setItem('lms-app.student-snapshot.student-2', JSON.stringify(studentTwoSnapshot));
    localStorage.setItem('lms-session', JSON.stringify({ studentId: 'student-1' }));

    const service = TestBed.inject(StudentDataService);

    expect(service.profile().email).toBe('alice.johnson@skillsconnect.app');
    expect(service.messages()[0]?.id).toBe('student-1-message');
    expect(service.mentorshipProfile().mentorName).toBe('Ava');

    localStorage.setItem('lms-session', JSON.stringify({ studentId: 'student-2' }));
    service.refreshForCurrentSession();

    expect(service.profile().email).toBe('brian.molefe@skillsconnect.app');
    expect(service.messages()[0]?.id).toBe('student-2-message');
    expect(service.mentorshipProfile().mentorName).toBe('Theo');
    expect(service.courses()[0]?.offeringId).toBe('student-2-course');
    expect(service.assessmentAttempts()['student-2-assessment']?.passed).toBe(true);
  });
});