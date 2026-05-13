import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentBadge, StudentDataService } from './student-data.service';

type ConfettiPiece = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  rotation: string;
  color: string;
};

type FireworkBurst = {
  id: number;
  left: string;
  top: string;
  delay: string;
  color: string;
};

@Component({
  selector: 'student-badges',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="badges-section">
      <div class="section-heading-row">
        <div>
          <h2>Badges & Certificates</h2>
          <p class="section-copy">Track the badges you have earned and the next milestones you can unlock.</p>
        </div>
        <span class="section-badge">{{ studentData.earnedBadgesCount() }} earned</span>
      </div>

      <div class="badges-grid">
        @for (badge of studentData.badges(); track badge.id) {
          <button
            type="button"
            class="badge-card"
            [class.badge-card-locked]="!badge.earned"
            [class.badge-card-selected]="selectedBadge()?.id === badge.id"
            (click)="openBadge(badge)">
            <div class="badge-mark" [style.background]="badge.color">
              @if (badge.icon === 'star') {
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.52l-5.3 2.79 1.01-5.9L3.42 9.23l5.93-.86L12 3Z" fill="currentColor"/></svg>
              }
              @if (badge.icon === 'bolt') {
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 6 13h4l-1 9 7-11h-4l1-9Z" fill="currentColor"/></svg>
              }
              @if (badge.icon === 'book') {
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5A2.5 2.5 0 0 0 16.5 16H5V5.5Z" fill="currentColor"/><path d="M5 16v1a2 2 0 0 0 2 2h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              }
              @if (badge.icon === 'flask') {
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 3h4M10 3v4.5l-4.8 7.7A3 3 0 0 0 7.76 20h8.48a3 3 0 0 0 2.56-4.8L14 7.5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 14h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              }
            </div>
            <span class="badge-title badge-title-card">{{ badge.title }}</span>
          </button>
        }
      </div>

      <div class="certificate-card">
        <div class="certificate-info">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="3" fill="#38bdf8"/><rect x="6" y="10" width="12" height="2" rx="1" fill="#fff"/><circle cx="12" cy="16" r="2" fill="#fff"/></svg>
          <div>
            <div class="certificate-title">Certificate of Completion</div>
            <div class="certificate-course">Company Induction</div>
            <div class="certificate-date">Awarded: April 2026</div>
          </div>
        </div>
        <button class="download-certificate-btn" type="button" (click)="downloadCertificate()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="17" width="16" height="4" rx="2" fill="#38bdf8"/></svg>
          Download PDF
        </button>
      </div>
    </section>

    @if (selectedBadge()) {
      <div class="badge-modal" aria-label="Selected badge details" role="dialog" aria-modal="true">
        <button type="button" class="badge-modal-backdrop" aria-label="Close badge details" (click)="closeBadge()"></button>

        <section class="badge-detail-card">
          <div class="badge-fireworks-layer" aria-hidden="true">
            @for (burst of fireworkBursts; track burst.id) {
              <span
                class="badge-firework-burst"
                [style.left]="burst.left"
                [style.top]="burst.top"
                [style.animation-delay]="burst.delay"
                [style.--firework-color]="burst.color">
                <span class="badge-firework-core"></span>
                @for (angle of fireworkRayAngles; track angle) {
                  <span class="badge-firework-ray" [style.--ray-angle]="angle"></span>
                }
              </span>
            }
          </div>

          <div class="badge-confetti-layer" aria-hidden="true">
            @for (piece of confettiPieces; track piece.id) {
              <span
                class="badge-confetti-piece"
                [style.left]="piece.left"
                [style.animation-delay]="piece.delay"
                [style.animation-duration]="piece.duration"
                [style.transform]="'rotate(' + piece.rotation + ')'"
                [style.background]="piece.color"></span>
            }
          </div>

          <div class="badge-detail-header">
            <div class="badge-mark badge-mark-large" [style.background]="selectedBadge()!.color">
              @if (selectedBadge()!.icon === 'star') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.52l-5.3 2.79 1.01-5.9L3.42 9.23l5.93-.86L12 3Z" fill="currentColor"/></svg>
              }
              @if (selectedBadge()!.icon === 'bolt') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 6 13h4l-1 9 7-11h-4l1-9Z" fill="currentColor"/></svg>
              }
              @if (selectedBadge()!.icon === 'book') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5A2.5 2.5 0 0 0 16.5 16H5V5.5Z" fill="currentColor"/><path d="M5 16v1a2 2 0 0 0 2 2h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              }
              @if (selectedBadge()!.icon === 'flask') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 3h4M10 3v4.5l-4.8 7.7A3 3 0 0 0 7.76 20h8.48a3 3 0 0 0 2.56-4.8L14 7.5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 14h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              }
            </div>

            <div class="badge-detail-copy">
              <div class="badge-title badge-title-large">{{ selectedBadge()!.title }}</div>
              <div class="badge-category badge-category-large">{{ selectedBadge()!.category }}</div>
              <p class="badge-copy badge-copy-large">{{ selectedBadge()!.description }}</p>
              <div class="badge-earned-on badge-earned-on-large">{{ selectedBadge()!.earned ? ('Earned ' + selectedBadge()!.earnedOn) : selectedBadge()!.earnedOn }}</div>
            </div>

            <button type="button" class="badge-close-btn" (click)="closeBadge()">Close</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }

    .badges-section {
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.6rem;
      background: rgba(255, 255, 255, 0.94);
      border-radius: 24px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    }

    .section-heading-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    h2 {
      margin: 0;
      color: #14213d;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .section-copy {
      margin: 0.3rem 0 0;
      color: #64748b;
      font-size: 0.96rem;
    }

    .section-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      background: #eef2ff;
      color: #4f46e5;
      font-size: 0.88rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .badge-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      width: 100%;
      min-height: 9.75rem;
      padding: 1.1rem 0.9rem;
      border-radius: 20px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      border: 1px solid #dbe7f5;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
      text-align: center;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .badge-card:hover,
    .badge-card:focus-visible {
      transform: translateY(-1px);
      border-color: #a5b4fc;
      box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
      outline: none;
    }

    .badge-card-locked {
      opacity: 0.78;
    }

    .badge-card-selected {
      border-color: #6366f1;
      box-shadow: 0 18px 34px rgba(99, 102, 241, 0.14);
    }

    .badge-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 18px;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 800;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
    }

    .badge-title-card {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      max-width: 100%;
      color: #14213d;
      font-size: 0.95rem;
      font-weight: 800;
      line-height: 1.35;
      text-wrap: balance;
    }

    .badge-mark-large {
      width: 5.25rem;
      height: 5.25rem;
      border-radius: 26px;
    }

    .badge-card-body {
      display: grid;
      gap: 0.45rem;
      min-width: 0;
    }

    .badge-card-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .badge-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 800;
    }

    .badge-category,
    .badge-earned-on,
    .badge-copy {
      color: #64748b;
      font-size: 0.88rem;
    }

    .badge-copy {
      margin: 0;
      line-height: 1.5;
    }

    .badge-state {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.78rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .badge-state-locked {
      background: #e2e8f0;
      color: #475569;
    }

    .certificate-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.2rem;
      width: min(100%, 540px);
      padding: 2rem 1.5rem;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
    }

    .certificate-info {
      display: flex;
      align-items: center;
      gap: 1.1rem;
      width: 100%;
    }

    .certificate-title {
      color: #2563eb;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .certificate-course {
      color: #14213d;
      font-size: 1rem;
      margin-top: 0.2rem;
    }

    .certificate-date {
      color: #64748b;
      font-size: 0.92rem;
      margin-top: 0.15rem;
    }

    .download-certificate-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #38bdf8, #2563eb);
      color: #fff;
      padding: 0.8rem 1.35rem;
      font-size: 0.98rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
    }

    .badge-modal {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      z-index: 40;
    }

    .badge-modal-backdrop {
      position: absolute;
      inset: 0;
      border: none;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      cursor: pointer;
      animation: badge-modal-backdrop-in 180ms ease-out;
    }

    .badge-detail-card {
      position: relative;
      z-index: 2;
      width: min(100%, 42rem);
      padding: 1rem;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      border: 1px solid #dbe7f5;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
      transform-origin: center;
      animation: badge-modal-card-in 220ms cubic-bezier(.2,.8,.2,1);
      overflow: hidden;
    }

    .badge-confetti-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 1;
    }

    .badge-fireworks-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 1;
    }

    .badge-firework-burst {
      --firework-color: #f59e0b;
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
      animation: badge-firework-burst 1400ms cubic-bezier(.2,.8,.2,1) 1 both;
    }

    .badge-firework-core {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 999px;
      background: var(--firework-color);
      box-shadow: 0 0 18px color-mix(in srgb, var(--firework-color) 78%, white 22%);
      transform: translate(-50%, -50%);
    }

    .badge-firework-ray {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0.18rem;
      height: 2.9rem;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, var(--firework-color) 38%, rgba(255, 255, 255, 0) 100%);
      transform-origin: 50% 0%;
      transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(0.2);
      opacity: 0;
      animation: badge-firework-ray 1400ms cubic-bezier(.2,.8,.2,1) 1 both;
      animation-delay: inherit;
    }

    .badge-confetti-piece {
      position: absolute;
      top: -1.25rem;
      width: 0.7rem;
      height: 1rem;
      border-radius: 999px;
      opacity: 0;
      animation-name: badge-confetti-fall;
      animation-timing-function: cubic-bezier(.18,.8,.22,1);
      animation-fill-mode: both;
    }

    @keyframes badge-modal-backdrop-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes badge-modal-card-in {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.94);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes badge-firework-burst {
      0%,
      100% {
        opacity: 0;
        transform: scale(0.2);
      }

      12% {
        opacity: 1;
        transform: scale(0.35);
      }

      28% {
        opacity: 1;
        transform: scale(1);
      }

      48% {
        opacity: 0;
        transform: scale(1.2);
      }
    }

    @keyframes badge-firework-ray {
      0%,
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(0.15);
      }

      14% {
        opacity: 1;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(0.35);
      }

      30% {
        opacity: 0.95;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(1);
      }

      48% {
        opacity: 0;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(1.18);
      }
    }

    @keyframes badge-confetti-fall {
      0% {
        opacity: 0;
        transform: translate3d(0, -0.75rem, 0) scale(0.8) rotate(0deg);
      }

      15% {
        opacity: 1;
      }

      100% {
        opacity: 0;
        transform: translate3d(1rem, 18rem, 0) scale(1) rotate(240deg);
      }
    }

    .badge-detail-header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: start;
      position: relative;
      z-index: 2;
    }

    .badge-detail-copy {
      display: grid;
      gap: 0.35rem;
      min-width: 0;
    }

    .badge-close-btn {
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      padding: 0.5rem 0.85rem;
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
    }

    .badge-title-large {
      font-size: 1.3rem;
    }

    .badge-category-large,
    .badge-earned-on-large,
    .badge-copy-large {
      font-size: 0.98rem;
    }

    .badge-copy-large {
      max-width: 34rem;
      line-height: 1.65;
    }

    @media (max-width: 720px) {
      .section-heading-row,
      .badge-card-row,
      .badge-detail-header,
      .certificate-info {
        flex-direction: column;
        align-items: flex-start;
      }

      .badge-detail-header {
        display: flex;
      }

      .certificate-card,
      .download-certificate-btn,
      .badge-close-btn {
        width: 100%;
      }
    }
  `],
})
export class StudentBadgesComponent {
  readonly studentData = inject(StudentDataService);
  private readonly selectedBadgeSignal = signal<StudentBadge | null>(null);
  readonly selectedBadge = computed(() => this.selectedBadgeSignal());
  readonly fireworkRayAngles = ['0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'];
  readonly fireworkBursts: FireworkBurst[] = [
    { id: 1, left: '16%', top: '22%', delay: '80ms', color: '#f97316' },
    { id: 2, left: '50%', top: '16%', delay: '260ms', color: '#38bdf8' },
    { id: 3, left: '80%', top: '24%', delay: '520ms', color: '#a855f7' },
    { id: 4, left: '26%', top: '68%', delay: '760ms', color: '#22c55e' },
    { id: 5, left: '72%', top: '70%', delay: '1020ms', color: '#f43f5e' },
  ];
  readonly confettiPieces: ConfettiPiece[] = [
    { id: 1, left: '4%', delay: '0ms', duration: '940ms', rotation: '-22deg', color: '#f97316' },
    { id: 2, left: '10%', delay: '40ms', duration: '1100ms', rotation: '18deg', color: '#22c55e' },
    { id: 3, left: '16%', delay: '90ms', duration: '980ms', rotation: '-14deg', color: '#38bdf8' },
    { id: 4, left: '24%', delay: '30ms', duration: '1200ms', rotation: '30deg', color: '#f43f5e' },
    { id: 5, left: '31%', delay: '120ms', duration: '1050ms', rotation: '-35deg', color: '#facc15' },
    { id: 6, left: '38%', delay: '70ms', duration: '1150ms', rotation: '22deg', color: '#8b5cf6' },
    { id: 7, left: '45%', delay: '10ms', duration: '930ms', rotation: '-18deg', color: '#14b8a6' },
    { id: 8, left: '52%', delay: '140ms', duration: '1180ms', rotation: '24deg', color: '#ef4444' },
    { id: 9, left: '59%', delay: '50ms', duration: '1010ms', rotation: '-28deg', color: '#0ea5e9' },
    { id: 10, left: '66%', delay: '100ms', duration: '1120ms', rotation: '16deg', color: '#84cc16' },
    { id: 11, left: '73%', delay: '20ms', duration: '960ms', rotation: '-20deg', color: '#fb7185' },
    { id: 12, left: '80%', delay: '130ms', duration: '1160ms', rotation: '34deg', color: '#f59e0b' },
    { id: 13, left: '87%', delay: '60ms', duration: '1080ms', rotation: '-16deg', color: '#6366f1' },
    { id: 14, left: '93%', delay: '150ms', duration: '1220ms', rotation: '20deg', color: '#10b981' },
  ];

  openBadge(badge: StudentBadge) {
    this.selectedBadgeSignal.set(badge);
  }

  closeBadge() {
    this.selectedBadgeSignal.set(null);
  }

  downloadCertificate() {
    import('jspdf').then((jsPDFModule) => {
      const jsPDF = jsPDFModule.jsPDF;
      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Certificate of Completion', 105, 40, { align: 'center' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('This certifies that you have successfully completed', 105, 60, { align: 'center' });
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Company Induction', 105, 80, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Awarded: April 2026', 105, 100, { align: 'center' });
      doc.setFontSize(12);
      doc.text('skillsconnect LMS', 105, 120, { align: 'center' });
      doc.save('Certificate-Company-Induction.pdf');
    });
  }
}
