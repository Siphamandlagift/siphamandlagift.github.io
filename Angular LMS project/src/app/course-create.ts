import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-course-create',
  standalone: true,
  templateUrl: './course-create.html',
  styleUrl: './course-create.css',
})
export class CourseCreate {
  readonly courseName = signal('');
  readonly description = signal('');
  readonly category = signal('');
  readonly submitted = signal(false);

  onSubmit() {
    this.submitted.set(true);
    // Here you would send the course data to a backend or service
    // For now, just show a success message
  }
}
