import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CertificateService, Certificate } from './certificate.service';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [DatePipe],
  template: `
    <h2>Certificates</h2>
    <button (click)="issueSampleCertificate()">Issue Sample Certificate</button>
    <table border="1" cellpadding="4" style="margin-top:1rem; width:100%; max-width:700px;">
      <tr><th>Course</th><th>Issued At</th><th>Certificate</th></tr>
      <tr *ngFor="let cert of certificates">
        <td>{{ cert.courseTitle }}</td>
        <td>{{ cert.issuedAt | date:'short' }}</td>
        <td><a [href]="cert.certificateUrl" target="_blank">Download PDF</a></td>
      </tr>
    </table>
  `,
  providers: [CertificateService],
})
export class CertificatesComponent {
  currentUserId = 1; // Simulate logged-in user
  certificates: Certificate[] = [];

  constructor(public certificateService: CertificateService) {
    this.certificates = this.certificateService.getCertificatesForUser(this.currentUserId);
  }

  issueSampleCertificate() {
    // Simulate issuing a certificate for a completed course
    this.certificateService.issueCertificate(this.currentUserId, 101, 'Angular Fundamentals');
    this.certificates = this.certificateService.getCertificatesForUser(this.currentUserId);
  }
}