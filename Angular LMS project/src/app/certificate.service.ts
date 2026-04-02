import { Injectable, signal } from '@angular/core';

export interface Certificate {
  studentName: string;
  courseTitle: string;
  dateIssued: string;
}

@Injectable({ providedIn: 'root' })
export class CertificateService {
  private readonly certificates = signal<Certificate[]>([]);

  issueCertificate(studentName: string, courseTitle: string) {
    const cert: Certificate = {
      studentName,
      courseTitle,
      dateIssued: new Date().toISOString().split('T')[0],
    };
    this.certificates.update(list => [...list, cert]);
  }

  getCertificatesForStudent(studentName: string) {
    return this.certificates().filter(c => c.studentName === studentName);
  }
}
