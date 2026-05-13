import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { vi } from 'vitest';

import { LmsBackendService } from './lms-backend.service';
import { StudentCoursesComponent } from './student-courses.component';
import { StudentDataService } from './student-data.service';
import { TrainingManagerDataService } from './training-manager-data.service';

describe('StudentCoursesComponent quiz retake flow', () => {
  let component: StudentCoursesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LmsBackendService,
          useValue: {
            upsertQuizSubmission: vi.fn(),
          },
        },
        {
          provide: StudentDataService,
          useValue: {
            courseNavigationRequest: () => null,
            inProgressCourses: () => [],
            completedCourses: () => [],
            clearCourseNavigationRequest: vi.fn(),
            syncCourseProgress: () => null,
          },
        },
        {
          provide: TrainingManagerDataService,
          useValue: {
            students: () => [],
            offerings: () => [],
            assignmentSubmissionForStudentOffering: () => null,
            mentorshipSubmissionForStudentOffering: () => null,
          },
        },
        {
          provide: DomSanitizer,
          useValue: {
            bypassSecurityTrustResourceUrl: (value: string) => value,
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new StudentCoursesComponent());
  });

  function setFailedQuizState(retakeActive = false) {
    const attemptKey = 'offering-1::assessment-1';

    (component as unknown as {
      selectedAssessment: () => { assessmentType: 'Quiz'; questions: Array<{ id: string }>; maxAttempts: number };
      currentQuizAttempt: () => {
        attemptsUsed: number;
        passed: boolean;
        lastScorePercentage: number;
        lastScoreEarned: number;
        lastScorePossible: number;
        lastSubmittedAt: string;
      };
      currentQuizAttemptKey: () => string;
      hasAssessmentAttemptsRemaining: () => boolean;
    }).selectedAssessment = () => ({
      assessmentType: 'Quiz',
      questions: [{ id: 'question-1' }],
      maxAttempts: 2,
    });
    (component as unknown as {
      currentQuizAttempt: () => {
        attemptsUsed: number;
        passed: boolean;
        lastScorePercentage: number;
        lastScoreEarned: number;
        lastScorePossible: number;
        lastSubmittedAt: string;
      };
    }).currentQuizAttempt = () => ({
      attemptsUsed: 1,
      passed: false,
      lastScorePercentage: 40,
      lastScoreEarned: 2,
      lastScorePossible: 5,
      lastSubmittedAt: '2026-05-03T11:00:00.000Z',
    });
    (component as unknown as { currentQuizAttemptKey: () => string }).currentQuizAttemptKey = () => attemptKey;
    (component as unknown as { hasAssessmentAttemptsRemaining: () => boolean }).hasAssessmentAttemptsRemaining = () => true;
    component.retakingQuizAssessments.set(retakeActive ? { [attemptKey]: true } : {});

    return attemptKey;
  }

  it('keeps a failed quiz locked after submission until the learner starts a retake', () => {
    setFailedQuizState();

    expect(component.isAssessmentSubmitted()).toBe(true);
    expect(component.canStartQuizRetake()).toBe(true);
    expect(component.submittedAssessmentButtonLabel()).toBe('Assessment Not Passed');
  });

  it('unlocks the quiz only after the learner chooses to retake it', () => {
    const attemptKey = setFailedQuizState();

    component.startQuizRetake();

    expect(component.retakingQuizAssessments()[attemptKey]).toBe(true);
    expect(component.isAssessmentSubmitted()).toBe(false);
    expect(component.canStartQuizRetake()).toBe(false);
    expect(component.submitAssessmentButtonLabel()).toBe('Submit Retake');
  });
});