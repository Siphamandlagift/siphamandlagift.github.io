import { Component } from '@angular/core';
// ...existing code...
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssignmentService, Assignment } from './assignment.service';
import { GradingService, AssignmentGrade } from './grading.service';

@Component({
  selector: 'app-assignments',
  standalone: true,
  template: `
    <h2>Assignments</h2>
    <table border="1" cellpadding="4" style="margin-top:1rem; width:100%; max-width:900px;">
      <tr>
        <th>Title</th>
        <th>Description</th>
        <th>Due Date</th>
        <th>Submission</th>
        <th>Status</th>
        <th>Grade & Feedback</th>
      </tr>
      <tr *ngFor="let a of assignments">
        <td>{{ a.title }}</td>
        <td>{{ a.description }}</td>
        <td>{{ a.dueDate }}</td>
        <td>
          <ng-container *ngIf="!assignmentService.getUserSubmission(a.id, currentUserId); else submittedBlock">
            <input type="file" (change)="onFileChange($event, a.id)" [disabled]="uploading[a.id]" />
            <button (click)="submit(a.id)" [disabled]="!selectedFiles[a.id] || uploading[a.id]">Submit</button>
          </ng-container>
          <ng-template #submittedBlock>
            <span style="color:green;">Submitted</span>
          </ng-template>
        </td>
        <td>
          <ng-container *ngIf="assignmentService.getUserSubmission(a.id, currentUserId) as sub">
            Submitted at {{ sub.submittedAt | date:'short' }}
            <a *ngIf="sub.fileUrl" [href]="sub.fileUrl" target="_blank">View File</a>
          </ng-container>
        </td>
        <td>
          <ng-container *ngIf="gradingService.getGrade(a.id, currentUserId) as grade">
            <b>Grade:</b> {{ grade.grade }}<br />
            <b>Feedback:</b> {{ grade.feedback }}<br />
            <span style="font-size:smaller;">Graded at {{ grade.gradedAt | date:'short' }}</span>
          </ng-container>
          <ng-container *ngIf="!gradingService.getGrade(a.id, currentUserId)">
            <span style="color:gray;">Not graded yet</span>
          </ng-container>
        </td>
      </tr>
    </table>

    <div style="margin-top:2rem;" *ngIf="isInstructor">
      <h3>Grade Submissions (Instructor Only)</h3>
      <table border="1" cellpadding="4" style="width:100%; max-width:900px;">
        <tr>
          <th>Assignment</th>
          <th>User ID</th>
          <th>Submission</th>
          <th>Grade</th>
          <th>Feedback</th>
          <th>Action</th>
        </tr>
        <tr *ngFor="let a of assignments">
          <ng-container *ngFor="let sub of a.submittedBy">
            <tr>
              <td>{{ a.title }}</td>
              <td>{{ sub.userId }}</td>
              <td>
                <a *ngIf="sub.fileUrl" [href]="sub.fileUrl" target="_blank">View File</a>
                <span *ngIf="!sub.fileUrl">No file</span>
              </td>
              <td>
                <input [(ngModel)]="gradingInputs[a.id + '-' + sub.userId].grade" placeholder="Grade" style="width:60px;" />
              </td>
              <td>
                <input [(ngModel)]="gradingInputs[a.id + '-' + sub.userId].feedback" placeholder="Feedback" style="width:120px;" />
              </td>
              <td>
                <button (click)="grade(a.id, sub.userId)">Save</button>
                <span *ngIf="gradingService.getGrade(a.id, sub.userId)">✔</span>
              </td>
            </tr>
          </ng-container>
        </tr>
      </table>
    </div>
  `,
  imports: [CommonModule, FormsModule],
  providers: [AssignmentService, GradingService],
})
export class AssignmentsComponent {
  currentUserId = 1; // Simulate logged-in user
  isInstructor = true; // Toggle for instructor view
  assignments: Assignment[] = [];
  selectedFiles: { [assignmentId: number]: File } = {};
  uploading: { [assignmentId: number]: boolean } = {};
  gradingInputs: { [key: string]: { grade: string; feedback: string } } = {};

  constructor(
    public assignmentService: AssignmentService,
    public gradingService: GradingService
  ) {
    this.assignments = this.assignmentService.getAssignments();
    // Prepopulate gradingInputs for all submissions
    this.assignments.forEach(a => {
      a.submittedBy.forEach(sub => {
        const key = a.id + '-' + sub.userId;
        const existing = this.gradingService.getGrade(a.id, sub.userId);
        this.gradingInputs[key] = {
          grade: existing?.grade || '',
          feedback: existing?.feedback || ''
        };
      });
    });
  }

  onFileChange(event: any, assignmentId: number) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFiles[assignmentId] = file;
    }
  }

  submit(assignmentId: number) {
    // Simulate file upload and submission
    this.uploading[assignmentId] = true;
    setTimeout(() => {
      // In a real app, upload file and get URL
      const fileUrl = this.selectedFiles[assignmentId] ? URL.createObjectURL(this.selectedFiles[assignmentId]) : undefined;
      this.assignmentService.submitAssignment(assignmentId, this.currentUserId, fileUrl);
      this.uploading[assignmentId] = false;
    }, 1000);
  }

  grade(assignmentId: number, userId: number) {
    const key = assignmentId + '-' + userId;
    const { grade, feedback } = this.gradingInputs[key];
    if (grade) {
      this.gradingService.setGrade(assignmentId, userId, grade, feedback);
    }
  }
}