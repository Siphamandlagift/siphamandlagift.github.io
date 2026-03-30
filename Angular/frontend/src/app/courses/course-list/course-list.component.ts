
import { Component } from '@angular/core';
// ...existing code...
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CourseService, Course } from '../course.service';
import { ProgressService } from '../progress.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Course Management</h2>
    <button (click)="showAdd = !showAdd">{{ showAdd ? 'Cancel' : 'Add Course' }}</button>
    <table border="1" cellpadding="4" style="margin-top:1rem; width:100%; max-width:700px;">
      <tr><th>Name</th><th>Description</th><th>Sections</th><th>Your Progress</th><th>Actions</th></tr>
      <tr *ngFor="let course of courseService.courses()">
        <td>{{ course.name }}</td>
        <td>{{ course.description }}</td>
        <td>{{ course.sections.length }}</td>
        <td>
          <span *ngIf="currentUserId !== null">
            <input type="number" min="0" max="100" [value]="progressService.getProgress(currentUserId, course.id)" (change)="updateProgress(currentUserId, course.id, $event.target.value)" style="width:60px;" />%
          </span>
        </td>
        <td>
          <button (click)="editCourse(course.id)">Edit</button>
          <button (click)="deleteCourse(course.id)">Delete</button>
        </td>
      </tr>
    </table>
    <div *ngIf="showAdd" style="margin-top:1rem;">
      <h3>Add Course</h3>
      <form (ngSubmit)="onAdd()" #addForm="ngForm">
        <input name="name" [(ngModel)]="newCourse.name" placeholder="Course Name" required />
        <input name="description" [(ngModel)]="newCourse.description" placeholder="Description" required />
        <button type="submit">Add</button>
      </form>
    </div>
  `,
  // ...existing code...
})
export class CourseListComponent {
  showAdd = false;
  newCourse: Partial<Course> = { name: '', description: '', sections: [], progress: 0 };
  currentUserId: number | null = null;
  constructor(
    public courseService: CourseService,
    private router: Router,
    public progressService: ProgressService,
    public authService: AuthService
  ) {
    this.currentUserId = this.authService.currentUser()?.id ?? null;
  }
  updateProgress(userId: number, courseId: number, value: any) {
    const progress = Math.max(0, Math.min(100, Number(value)));
    this.progressService.setProgress(userId, courseId, progress);
  }

  onAdd() {
    if (this.newCourse.name && this.newCourse.description) {
      this.courseService.addCourse({
        name: this.newCourse.name,
        description: this.newCourse.description,
        sections: [],
        progress: 0
      });
      this.newCourse = { name: '', description: '', sections: [], progress: 0 };
      this.showAdd = false;
    }
  }

  editCourse(id: number) {
    this.router.navigate(['/courses/edit', id]);
  }

  deleteCourse(id: number) {
    this.courseService.deleteCourse(id);
  }
}