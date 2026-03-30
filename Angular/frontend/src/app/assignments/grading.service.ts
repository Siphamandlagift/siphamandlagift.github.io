import { Injectable } from '@angular/core';

export interface AssignmentGrade {
  assignmentId: number;
  userId: number;
  grade: string;
  feedback: string;
  gradedAt: string;
}

@Injectable({ providedIn: 'root' })
export class GradingService {
  private grades: AssignmentGrade[] = [];

  setGrade(assignmentId: number, userId: number, grade: string, feedback: string) {
    const idx = this.grades.findIndex(g => g.assignmentId === assignmentId && g.userId === userId);
    const gradedAt = new Date().toISOString();
    if (idx > -1) {
      this.grades[idx] = { assignmentId, userId, grade, feedback, gradedAt };
    } else {
      this.grades.push({ assignmentId, userId, grade, feedback, gradedAt });
    }
  }

  getGrade(assignmentId: number, userId: number): AssignmentGrade | undefined {
    return this.grades.find(g => g.assignmentId === assignmentId && g.userId === userId);
  }

  getAllGrades(): AssignmentGrade[] {
    return this.grades;
  }
}
