import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingOffering } from './training-manager-data.service';

@Component({
  selector: 'published-offering-card',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="offering-card"
      [class.offering-card-active]="selected()"
      tabindex="0"
      role="button"
      [attr.aria-label]="'Open details for ' + offering().title"
      (click)="open.emit()"
      (keydown.enter)="open.emit()"
      (keydown.space)="openFromKeyboard($event)">
      <div
        class="offering-card-top"
        [style.background-image]="offering().thumbnailDataUrl ? 'url(' + offering().thumbnailDataUrl + ')' : 'linear-gradient(135deg, #6366f1, #38bdf8)'">
        <div class="offering-card-top-row">
          <span class="offering-status-pill">{{ offering().status }}</span>
          <span class="offering-type-pill">{{ offering().type }}</span>
        </div>
        @if (offering().thumbnailDataUrl) {
          <div class="offering-thumbnail-badge-row">
            <span class="offering-thumbnail-badge">Custom thumbnail</span>
          </div>
        }
      </div>

      <div class="offering-card-body">
        <div class="offering-top-row">
          <span class="offering-date">{{ offering().createdOn }}</span>
          <span>{{ assignedCount() }} assigned</span>
        </div>

        <div class="offering-title">{{ offering().title }}</div>
        <p class="offering-copy">{{ offering().description }}</p>

        <div class="offering-actions">
          <button type="button" class="offering-action-btn offering-action-btn-primary" (click)="openFromAction($event)">View details</button>
          <button type="button" class="offering-action-btn" (click)="enroll.emit(); $event.stopPropagation()">Assign learners</button>
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .offering-card {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 24px;
      overflow: hidden;
      background: linear-gradient(180deg, #ffffff 0%, #f8fcfc 100%);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      transition: transform 180ms ease, box-shadow 180ms ease;
      cursor: pointer;
    }

    .offering-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
    }

    .offering-card:focus-visible {
      outline: 3px solid rgba(79, 70, 229, 0.28);
      outline-offset: 3px;
    }

    .offering-card-active {
      border-color: rgba(79, 70, 229, 0.42);
      box-shadow: 0 24px 48px rgba(79, 70, 229, 0.12);
    }

    .offering-card-top {
      min-height: 170px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background-size: cover;
      background-position: center;
      position: relative;
      isolation: isolate;
    }

    .offering-card-top::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.68));
      z-index: -1;
    }

    .offering-card-top-row,
    .offering-top-row {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    .offering-status-pill,
    .offering-type-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.34rem 0.7rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .offering-status-pill {
      background: rgba(255, 255, 255, 0.94);
      color: #0f172a;
    }

    .offering-type-pill {
      background: rgba(15, 23, 42, 0.5);
      color: #f8fafc;
      backdrop-filter: blur(6px);
    }

    .offering-card-body {
      padding: 1rem;
      display: grid;
      gap: 0.8rem;
      flex: 1;
    }

    .offering-thumbnail-badge-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .offering-thumbnail-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.34rem 0.62rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.9);
      color: #166534;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .offering-date,
    .offering-copy {
      color: #64748b;
    }

    .offering-title,
    .offering-copy,
    p {
      margin: 0;
    }

    .offering-title {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
    }

    .offering-copy {
      line-height: 1.55;
    }

    .offering-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .offering-action-btn {
      border: 1px solid rgba(99, 102, 241, 0.18);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.92);
      color: #4338ca;
      padding: 0.72rem 1rem;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .offering-action-btn:hover,
    .offering-action-btn:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.12);
      outline: none;
    }

    .offering-action-btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      border-color: transparent;
    }

    @media (max-width: 720px) {
      .offering-top-row {
        flex-direction: column;
        align-items: flex-start;
      }

      .offering-actions,
      .offering-action-btn {
        width: 100%;
      }
    }
  `],
})
export class PublishedOfferingCardComponent {
  readonly offering = input.required<TrainingOffering>();
  readonly selected = input(false);
  readonly assignedCount = input(0);

  readonly open = output<void>();
  readonly enroll = output<void>();

  openFromKeyboard(event: Event) {
    event.preventDefault();
    this.open.emit();
  }

  openFromAction(event: Event) {
    event.stopPropagation();
    this.open.emit();
  }
}