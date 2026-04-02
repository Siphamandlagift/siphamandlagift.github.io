import { Component, signal } from '@angular/core';

interface Assessment {
  title: string;
  description: string;
}

@Component({
  selector: 'app-course-assessments',
  standalone: true,
  templateUrl: './course-assessments.html',
  styleUrl: './course-assessments.css',
})
export class CourseAssessments {
  readonly assessments = signal<Assessment[]>([]);
  readonly title = signal('');
  readonly description = signal('');

  addAssessment() {
    if (this.title() && this.description()) {
      this.assessments.update(list => [
        ...list,
        { title: this.title(), description: this.description() }
      ]);
      this.title.set('');
      this.description.set('');
    }
  }
}
