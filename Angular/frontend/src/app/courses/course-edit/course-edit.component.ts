import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContentService, LearningContent } from '../content.service';
import { AuthService } from '../../auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CourseService } from '../course.service';
import { Course, CourseSection } from '../course.service';
@Component({
  selector: 'app-course-edit',
  standalone: true,
  template: `
    <h2>Edit Course</h2>
    <form *ngIf="course" (ngSubmit)="onSave()" #editForm="ngForm" style="max-width:400px;">
      <div>
        <label>Name:</label>
        <input name="name" [(ngModel)]="course.name" required />
      </div>
      <div>
        <label>Description:</label>
        <input name="description" [(ngModel)]="course.description" required />
      </div>
      <div>
        <label>Progress:</label>
        <input name="progress" type="number" [(ngModel)]="course.progress" min="0" max="100" />
      </div>
      <div>
        <h4>Sections</h4>
        <ul>
          <li *ngFor="let section of course.sections; let i = index">
            <input [(ngModel)]="section.title" name="sectionTitle{{i}}" placeholder="Title" required />
            <input [(ngModel)]="section.description" name="sectionDesc{{i}}" placeholder="Description" required />
            <button type="button" (click)="removeSection(i)">Remove</button>
            <div style="margin-left:2rem;">
              <h5>Learning Content</h5>
              <ul>
                <li *ngFor="let content of getSectionContent(section.id)">
                  <span>{{ content.title }} ({{ content.type }})</span>
                  <span *ngIf="content.type === 'video'">
                    <iframe width="200" height="113" [src]="content.url" frameborder="0"></iframe>
                  </span>
                  <span *ngIf="content.type === 'pdf'">
                    <a [href]="content.url" target="_blank">View PDF</a>
                  </span>
                  <span *ngIf="content.type === 'document'">
                    <a [href]="content.url" target="_blank">View Document</a>
                  </span>
                  <button *ngIf="currentUserId !== null && !contentService.isCompleted(content.id, currentUserId)" (click)="markCompleted(content.id)">Mark as Completed</button>
                  <span *ngIf="currentUserId !== null && contentService.isCompleted(content.id, currentUserId)" style="color:green;">Completed</span>
                </li>
              </ul>
            </div>
          </li>
        </ul>
        <button type="button" (click)="addSection()">Add Section</button>
      </div>
      <button type="submit">Save</button>
      <button type="button" (click)="cancel()">Cancel</button>
    </form>
    <div *ngIf="!course">Course not found.</div>
  `,
  imports: [CommonModule, FormsModule],
})
export class CourseEditComponent {
  course: Course | undefined;
  currentUserId: number | null = null;
  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private router: Router,
    public contentService: ContentService,
    public authService: AuthService
  ) {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.course = this.courseService.getCourse(id) ? { ...this.courseService.getCourse(id)!, sections: [...this.courseService.getCourse(id)!.sections.map((s: CourseSection) => ({...s}))] } : undefined;
    this.currentUserId = this.authService.currentUser()?.id ?? null;
  }

  onSave() {
    if (this.course) {
      this.courseService.updateCourse(this.course);
      this.router.navigate(['/courses']);
    }
  }

  cancel() {
    this.router.navigate(['/courses']);
  }

  addSection() {
    if (this.course) {
      this.course.sections.push({ id: Date.now(), title: '', description: '' });
    }
  }

  removeSection(i: number) {
    if (this.course) {
      this.course.sections.splice(i, 1);
    }
  }

  getSectionContent(sectionId: number) {
    if (!this.course) return [];
    return this.contentService.content().filter(c => c.sectionId === sectionId && c.courseId === this.course!.id);
  }

  markCompleted(contentId: number) {
    if (this.currentUserId !== null) {
      this.contentService.markCompleted(contentId, this.currentUserId);
    }
  }
}