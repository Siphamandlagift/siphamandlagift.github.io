import { Injectable, inject } from '@angular/core';
import { NotificationService } from '../notifications/notification.service';

export interface Assignment {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  submittedBy: { userId: number; fileUrl?: string; submittedAt: string }[];
}

@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private notificationService = inject(NotificationService);
  private assignments: Assignment[] = [
    {
      id: 1,
      title: 'Essay: The Future of Learning',
      description: 'Write a 1000-word essay on the future of online learning.',
      dueDate: '2024-07-01',
      submittedBy: []
    },
    {
      id: 2,
      title: 'Project: Build an Angular App',
      description: 'Create a simple Angular application and submit the code.',
      dueDate: '2024-07-10',
      submittedBy: []
    }
  ];

  getAssignments() {
    return this.assignments;
  }

  submitAssignment(assignmentId: number, userId: number, fileUrl?: string) {
    const assignment = this.assignments.find(a => a.id === assignmentId);
    if (assignment && !assignment.submittedBy.some(s => s.userId === userId)) {
      assignment.submittedBy.push({
        userId,
        fileUrl,
        submittedAt: new Date().toISOString()
      });
      // Send notification
      this.notificationService.send(userId, `Assignment submitted: ${assignment.title}`, 'info');
    }
  }

  getUserSubmission(assignmentId: number, userId: number) {
    const assignment = this.assignments.find(a => a.id === assignmentId);
    return assignment?.submittedBy.find(s => s.userId === userId);
  }
}
