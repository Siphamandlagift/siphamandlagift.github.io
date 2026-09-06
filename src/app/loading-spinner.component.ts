import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Shared "data is loading" indicator — replaces plain "Loading…" text wherever a screen is
// waiting on a network call. A conic-gradient ring masked into a circle (rather than the classic
// two-tone border-spin trick) gives a smooth fading comet-tail sweep instead of a hard two-color
// split, which reads as noticeably more polished at the small sizes this app uses it at.
@Component({
  selector: 'loading-spinner',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loading-spinner" role="status" [attr.aria-label]="label">
      <span
        class="loading-spinner-ring"
        [style.width.px]="size"
        [style.height.px]="size"
        [style.background]="'conic-gradient(from 0deg, transparent 0deg, ' + color + ' 320deg, ' + color + ' 360deg)'"
      ></span>
      @if (label) {
        <span class="loading-spinner-label">{{ label }}</span>
      }
    </div>
  `,
  styles: [`
    .loading-spinner {
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
    }
    .loading-spinner-ring {
      display: inline-block;
      border-radius: 50%;
      flex-shrink: 0;
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
      animation: loading-spinner-rotate 0.85s linear infinite;
    }
    .loading-spinner-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
    }
    @keyframes loading-spinner-rotate {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .loading-spinner-ring { animation-duration: 1.6s; }
    }
  `],
})
export class LoadingSpinnerComponent {
  @Input() size = 28;
  @Input() color = '#2563eb';
  @Input() label = 'Loading…';
}
