import { Injectable, signal, inject } from '@angular/core';
import { UserWithProfile } from '../users/user.service';
import { CertificateService } from '../certificates/certificate.service';
import { CourseService } from './course.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationService } from '../notifications/notification.service';

export interface UserCourseProgress {
  userId: number;
  courseId: number;
  progress: number; // percent
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private _progress = signal<UserCourseProgress[]>([]);
  progress = this._progress.asReadonly();

  private certificateService = inject(CertificateService);
  private courseService = inject(CourseService);
  private gamificationService = inject(GamificationService);
  private notificationService = inject(NotificationService);

  setProgress(userId: number, courseId: number, progress: number) {
    const exists = this._progress().find(p => p.userId === userId && p.courseId === courseId);
    if (exists) {
      this._progress.update(ps => ps.map(p => p.userId === userId && p.courseId === courseId ? { ...p, progress } : p));
    } else {
      this._progress.update(ps => [...ps, { userId, courseId, progress }]);
    }
    // Issue certificate and award badge/points if progress reaches 100% and not already issued
    if (progress === 100) {
      const course = this.courseService.getCourse(courseId);
      if (course && !this.certificateService.getCertificatesForUser(userId).some(c => c.courseId === courseId)) {
        this.certificateService.issueCertificate(userId, courseId, course.name);
        // Award 'Course Finisher' badge and points
        this.gamificationService.awardBadge(userId, 2); // 2 = Course Finisher
        this.gamificationService.addPoints(userId, 100);
        // Send notification
        this.notificationService.send(userId, `Congratulations! You completed the course: ${course.name}`, 'success');
      }
    }
  }

  getProgress(userId: number, courseId: number): number {
    return this._progress().find(p => p.userId === userId && p.courseId === courseId)?.progress ?? 0;
  }
}
