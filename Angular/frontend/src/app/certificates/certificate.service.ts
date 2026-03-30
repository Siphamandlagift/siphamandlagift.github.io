import { Injectable } from '@angular/core';

export interface Certificate {
  id: number;
  userId: number;
  courseId: number;
  courseTitle: string;
  issuedAt: string;
  certificateUrl: string;
}

@Injectable({ providedIn: 'root' })
export class CertificateService {
  private certificates: Certificate[] = [];

  issueCertificate(userId: number, courseId: number, courseTitle: string) {
    const id = this.certificates.length + 1;
    const issuedAt = new Date().toISOString();
    const certificateUrl = `/certificates/${id}.pdf`;
    const cert: Certificate = { id, userId, courseId, courseTitle, issuedAt, certificateUrl };
    this.certificates.push(cert);
    return cert;
  }

  getCertificatesForUser(userId: number): Certificate[] {
    return this.certificates.filter(c => c.userId === userId);
  }

  getAllCertificates(): Certificate[] {
    return this.certificates;
  }
}
