import { Component, signal, inject } from '@angular/core';
import { CertificateService } from './certificate.service';

@Component({
  selector: 'app-student-courses',
  standalone: true,
  templateUrl: './student-courses.html',
  styleUrl: './student-courses.css',
})
export class StudentCourses {
  readonly courses = signal([
    { title: 'Web Development', progress: 80, status: 'In Progress' },
    { title: 'Data Science Basics', progress: 100, status: 'Completed' },
    { title: 'UI/UX Design', progress: 45, status: 'In Progress' },
  ]);
  private readonly certificateService = inject(CertificateService);
  private readonly studentName = 'Jane Doe'; // TODO: Replace with real student name from profile

  markAsCompleted(index: number) {
    this.courses.update(courses => {
      const updated = [...courses];
      if (updated[index].status !== 'Completed') {
        updated[index] = { ...updated[index], progress: 100, status: 'Completed' };
        this.certificateService.issueCertificate(this.studentName, updated[index].title);
      }
      return updated;
    });
  }
}
