import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { LmsBackendService } from './lms-backend.service';
import { TrainingManagerDataService } from './training-manager-data.service';

describe('TrainingManagerDataService assignment submission hydration', () => {
  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LmsBackendService,
          useValue: {
            getBootstrap: () => throwError(() => new Error('offline')),
            patchManagerState: () => of({}),
          },
        },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('restores the exact assignment question total for stored marks after offerings load', () => {
    localStorage.setItem('lms-app.offerings', JSON.stringify([
      {
        id: 'offering-1',
        title: 'Customer Service Essentials',
        type: 'Course',
        category: 'Customer Success',
        description: 'Assignment scoring regression fixture',
        completionDeadline: '2026-05-30',
        thumbnailDataUrl: null,
        createdOn: '03 May 2026',
        status: 'Published',
        contentItems: [
          {
            id: 'assignment-1',
            kind: 'Assessment',
            title: 'Service Recovery Assignment',
            assessmentType: 'Assignment',
            passMarkPercentage: 70,
            maxAttempts: 2,
            resourceLink: '',
            uploadedFileName: '',
            uploadedFileDataUrl: '',
            questions: [
              {
                prompt: 'Question one',
                questionType: 'Short Answer',
                points: 10,
                choices: [],
                matchingPairs: [],
                dragAndDropEnabled: false,
                attachmentFileName: '',
                attachmentDataUrl: '',
              },
              {
                prompt: 'Question two',
                questionType: 'Long Answer',
                points: 81,
                choices: [],
                matchingPairs: [],
                dragAndDropEnabled: false,
                attachmentFileName: '',
                attachmentDataUrl: '',
              },
            ],
          },
        ],
      },
    ]));

    localStorage.setItem('lms-app.assignment-submissions', JSON.stringify([
      {
        id: 'submission-1',
        studentId: 'student-1',
        studentName: 'Alice Johnson',
        studentEmail: 'alice.johnson@skillsconnect.app',
        offeringId: 'offering-1',
        offeringTitle: 'Customer Service Essentials',
        assessmentStepId: 'assignment-1-question-2',
        assessmentTitle: 'Service Recovery Assignment',
        questionType: 'Long Answer',
        responseText: 'Escalate and resolve the complaint within one business day.',
        documentFileName: '',
        documentDataUrl: '',
        awardedPoints: 72,
        submittedAt: '03 May 2026',
        status: 'Approved',
        reviewerName: 'Ava Mokoena',
        reviewerFeedback: 'Solid resolution plan.',
        reviewedAt: '03 May 2026',
      },
    ]));

    const service = TestBed.runInInjectionContext(() => new TrainingManagerDataService());
    const submission = service.assignmentSubmissionForStudentOffering('student-1', 'offering-1', 'assignment-1-question-2');

    expect(submission?.possiblePoints).toBe(81);
    expect(submission?.awardedPoints).toBe(72);
  });

  it('routes student mentorship form submissions to the assigned manager review list', () => {
    const service = TestBed.runInInjectionContext(() => new TrainingManagerDataService());

    service.createMentorshipAssignment({
      menteeId: 'student-1',
      mentorshipStartDate: '2026-05-03',
      jobTitle: 'Operations Coordinator',
      mentorName: 'Ava',
      mentorSurname: 'Mokoena',
    });
    service.createMentorshipAssignment({
      menteeId: 'student-2',
      mentorshipStartDate: '2026-05-03',
      jobTitle: 'Customer Success Specialist',
      mentorName: 'Theo',
      mentorSurname: 'Naidoo',
    });

    service.submitMentorshipFormSubmission({
      studentId: 'student-1',
      studentName: 'Alice Johnson',
      studentEmail: 'alice.johnson@skillsconnect.app',
      mentorName: 'Ava Mokoena',
      formId: 'progress-report',
      formTitle: 'Mentorship Progress Report',
      sessionDate: '03 May 2026',
      actionPlan: 'Meeting date: 03 May 2026\n\nObjectives achieved:\n1. Completed induction goals',
    });
    service.submitMentorshipFormSubmission({
      studentId: 'student-2',
      studentName: 'Brian Molefe',
      studentEmail: 'brian.molefe@skillsconnect.app',
      mentorName: 'Theo Naidoo',
      formId: 'progress-report',
      formTitle: 'Mentorship Progress Report',
      sessionDate: '03 May 2026',
      actionPlan: 'Meeting date: 03 May 2026\n\nObjectives achieved:\n1. Escalation workflow reviewed',
    });

    const visibleSubmissions = service.mentorshipSubmissionsForCurrentManager();

    expect(visibleSubmissions.length).toBe(1);
    expect(visibleSubmissions[0]?.id).toBe('mentorship-form-student-1-progress-report');
    expect(visibleSubmissions[0]?.studentId).toBe('student-1');
    expect(visibleSubmissions[0]?.mentorName).toBe('Ava Mokoena');
    expect(visibleSubmissions[0]?.assessmentTitle).toBe('Mentorship Progress Report');
  });
});