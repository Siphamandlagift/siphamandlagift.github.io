import { Component, inject, signal } from '@angular/core';
import { CertificateService } from './certificate.service';

@Component({
  selector: 'app-student-certificates',
  standalone: true,
  templateUrl: './student-certificates.html',
  styleUrl: './student-certificates.css',
})
export class StudentCertificates {
  private readonly certificateService = inject(CertificateService);
  readonly studentName = 'Jane Doe'; // TODO: Replace with real student name from profile
  readonly certificates = signal(this.certificateService.getCertificatesForStudent(this.studentName));
}
