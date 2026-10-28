import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CertificateVerificationResult, LmsBackendService } from './lms-backend.service';

// The one page in this app reachable with no SkillsConnect session at all (see
// isPublicCertificateVerifyPath in server.ts) — reached either by typing a certificate's serial
// number in by hand, or by scanning the QR code printed on the PDF itself. Deliberately shows
// only CertificateVerificationResult's minimal fields, never the student's full record.
@Component({
  selector: 'app-verify-certificate',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="verify-page">
      <div class="verify-card">
        <div class="verify-brand">SkillsConnect</div>

        @if (state() === 'loading') {
          <p class="verify-status">Checking certificate…</p>
        }

        @if (state() === 'valid' && result()?.valid) {
          <div class="verify-badge verify-badge-valid" aria-hidden="true">✓</div>
          <h1>Certificate verified</h1>
          <p class="verify-subtitle">This certificate was genuinely issued by SkillsConnect.</p>

          <dl class="verify-details">
            <dt>Recipient</dt>
            <dd>{{ asValid(result())!.studentName }}</dd>
            <dt>Course</dt>
            <dd>{{ asValid(result())!.courseName }}</dd>
            <dt>Issued by</dt>
            <dd>{{ asValid(result())!.companyName }}</dd>
            <dt>Completion date</dt>
            <dd>{{ asValid(result())!.completionDate }}</dd>
            <dt>Serial number</dt>
            <dd><code>{{ asValid(result())!.serialNumber }}</code></dd>
          </dl>
        }

        @if (state() === 'invalid') {
          <div class="verify-badge verify-badge-invalid" aria-hidden="true">✕</div>
          <h1>Certificate not found</h1>
          <p class="verify-subtitle">This serial number doesn't match a SkillsConnect certificate on record. Double-check it against the certificate and try again.</p>
        }

        @if (state() === 'error') {
          <h1>Couldn't verify right now</h1>
          <p class="verify-subtitle">Something went wrong while checking this certificate. Please try again shortly.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .verify-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background: linear-gradient(180deg, #f4f7fb 0%, #e9eef6 100%);
      font-family: inherit;
    }

    .verify-card {
      width: min(100%, 30rem);
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid #dbe7f5;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
      padding: 2rem 1.75rem;
      text-align: center;
    }

    .verify-brand {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }

    .verify-badge {
      width: 3.25rem;
      height: 3.25rem;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0 auto 1rem;
    }

    .verify-badge-valid {
      background: #dcfce7;
      color: #166534;
    }

    .verify-badge-invalid {
      background: #fee2e2;
      color: #991b1b;
    }

    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.4rem;
      color: #14213d;
    }

    .verify-status,
    .verify-subtitle {
      margin: 0;
      color: #64748b;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .verify-details {
      margin: 1.5rem 0 0;
      text-align: left;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.4rem 0.9rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 1.25rem;
    }

    .verify-details dt {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      align-self: center;
    }

    .verify-details dd {
      margin: 0;
      color: #14213d;
      font-size: 0.92rem;
      font-weight: 600;
    }
  `],
})
export class VerifyCertificateComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly backend = inject(LmsBackendService);

  readonly state = signal<'loading' | 'valid' | 'invalid' | 'error'>('loading');
  readonly result = signal<CertificateVerificationResult | null>(null);

  constructor() {
    const serialNumber = this.route.snapshot.paramMap.get('serialNumber')?.trim() ?? '';
    if (!serialNumber) {
      this.state.set('invalid');
      return;
    }

    this.backend.verifyCertificate(serialNumber).subscribe({
      next: (response) => {
        this.result.set(response);
        this.state.set(response.valid ? 'valid' : 'invalid');
      },
      error: () => {
        this.state.set('error');
      },
    });
  }

  asValid(result: CertificateVerificationResult | null) {
    return result?.valid ? result : null;
  }
}
