import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentCalendarEvent, StudentDataService } from './student-data.service';

type CalendarDay = {
  date: Date;
  inCurrentMonth: boolean;
};

@Component({
  selector: 'student-calendar',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="calendar-shell" aria-labelledby="calendar-heading">
      <header class="calendar-hero">
        <div>
          <h2 id="calendar-heading" class="calendar-title">Calendar</h2>
          <p class="calendar-subtitle">Track assignment deadlines and important dates here. Complete the actual assignment work in Courses.</p>
        </div>
      </header>

      <div class="calendar-layout">
        <section class="calendar-panel" aria-label="Monthly calendar">
          <div class="calendar-toolbar calendar-toolbar-primary">
            <div class="calendar-toolbar-group">
              <button type="button" class="calendar-link-btn" (click)="goToToday()">Today</button>
              <div class="calendar-nav-btns">
                <button
                  type="button"
                  class="calendar-icon-btn"
                  (click)="prevMonth()"
                  aria-label="Go to previous month"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m14.5 6.5-5 5 5 5" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="calendar-icon-btn"
                  (click)="nextMonth()"
                  aria-label="Go to next month"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9.5 6.5 5 5-5 5" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="calendar-month-label">{{ visibleMonthLabel() }}</div>
          </div>

          <div class="calendar-grid" role="grid">
            @for (dayName of weekDays; track dayName) {
              <div class="calendar-day calendar-day-header" role="columnheader">{{ dayName }}</div>
            }

            @for (day of calendarDays(); track $index) {
              <button
                type="button"
                class="calendar-day"
                [class.calendar-day-other-month]="!day.inCurrentMonth"
                [class.calendar-day-today]="isToday(day)"
                [class.calendar-day-selected]="isSelected(day)"
                [attr.aria-pressed]="isSelected(day)"
                (click)="selectDay(day)"
              >
                <span class="calendar-day-number">{{ day.date | date:'dd' }}</span>
                @if (hasEvents(day.date)) {
                  <span class="event-dot" aria-hidden="true"></span>
                }
              </button>
            }
          </div>
        </section>

        <aside class="calendar-sidebar" aria-label="Calendar details">
          <section class="calendar-side-card">
            <div class="calendar-side-title">Selected Day</div>
            <div class="calendar-selected-date">{{ selectedDay() | date:'EEEE, MMM d, y' }}</div>

            @if (selectedDayEvents().length) {
              <ul class="event-list">
                @for (event of selectedDayEvents(); track event.id) {
                  <li class="event-item">
                    <div class="event-copy">
                      @if (event.actionLabel) {
                        <button type="button" class="event-title-link" (click)="openEvent(event)">{{ event.title }}</button>
                      } @else {
                        <span class="event-title">{{ event.title }}</span>
                      }
                      <span class="event-date">{{ event.date | date:'MMM d, y' }}</span>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="calendar-empty-copy">No events for this day.</p>
            }
          </section>

          <section class="calendar-side-card">
            <div class="calendar-side-title">Upcoming Events</div>

            @if (upcomingEvents().length) {
              <ul class="event-list">
                @for (event of upcomingEvents(); track event.id) {
                  <li class="event-item">
                    <div class="event-copy">
                      @if (event.actionLabel) {
                        <button type="button" class="event-title-link" (click)="openEvent(event)">{{ event.title }}</button>
                      } @else {
                        <span class="event-title">{{ event.title }}</span>
                      }
                      <span class="event-date">{{ event.date | date:'MMM d, y' }}</span>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="calendar-empty-copy">No upcoming events.</p>
            }
          </section>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      margin: 0;
      flex: 1;
    }

    .calendar-shell {
      background: #f8fbff;
      border-radius: 28px;
      padding: 1.2rem;
      color: #14213d;
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
    }

    .calendar-hero {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .calendar-title {
      margin: 0 0 0.2rem;
      font-size: clamp(1.7rem, 1.9vw, 2.05rem);
      font-weight: 700;
      color: #14213d;
    }

    .calendar-subtitle {
      margin: 0;
      max-width: 36rem;
      color: #5b6780;
      font-size: 0.92rem;
    }

    .calendar-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.9fr) minmax(18rem, 19rem);
      gap: 1.25rem;
      align-items: start;
    }

    .calendar-panel,
    .calendar-side-card {
      background: #fff;
      border: 1px solid #dbe5f0;
      border-radius: 20px;
      box-shadow: 0 18px 38px rgba(15, 23, 42, 0.05);
    }

    .calendar-panel {
      padding: 1.05rem;
      min-width: 0;
    }

    .calendar-sidebar {
      display: grid;
      gap: 1rem;
      min-width: 0;
    }

    .calendar-side-card {
      padding: 1rem;
    }

    .calendar-sidebar .calendar-side-card:last-child {
      max-height: 21rem;
      overflow: hidden;
    }

    .calendar-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.1rem;
      margin-bottom: 1rem;
    }

    .calendar-toolbar-primary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
    }

    .calendar-toolbar-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .calendar-toolbar-group-end {
      justify-content: flex-end;
    }

    .calendar-nav-btns {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .calendar-link-btn,
    .calendar-select-btn,
    .calendar-icon-btn {
      min-height: 2.5rem;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }

    .calendar-link-btn {
      padding: 0;
      border: 0;
      background: transparent;
      color: #2563eb;
      min-height: auto;
    }

    .calendar-select-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.65rem 0.95rem;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #1f3b63;
    }

    .calendar-select-btn svg,
    .calendar-icon-btn svg {
      width: 1rem;
      height: 1rem;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .calendar-icon-btn {
      width: 2.2rem;
      min-width: 2.2rem;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      background: transparent;
      color: #2563eb;
    }

    .calendar-link-btn:hover,
    .calendar-link-btn:focus-visible,
    .calendar-select-btn:hover,
    .calendar-select-btn:focus-visible,
    .calendar-icon-btn:hover,
    .calendar-icon-btn:focus-visible {
      background: #eff6ff;
      outline: none;
    }

    .calendar-link-btn:focus-visible,
    .calendar-select-btn:focus-visible,
    .calendar-icon-btn:focus-visible,
    .calendar-day:focus-visible {
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
      outline: none;
    }

    .calendar-month-label {
      justify-self: center;
      font-size: 1.1rem;
      font-weight: 700;
      color: #111827;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0;
      border: 1px solid #d5deea;
      border-radius: 0;
      overflow: hidden;
    }

    .calendar-day {
      aspect-ratio: auto;
      width: 100%;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      position: relative;
      min-height: 5rem;
      padding: 0.45rem 0.5rem;
      border-radius: 0;
      border: 0;
      border-right: 1px solid #d5deea;
      border-bottom: 1px solid #d5deea;
      background: #fff;
      color: #1f2937;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
    }

    .calendar-day:nth-child(7n) {
      border-right: 0;
    }

    .calendar-day-header {
      min-height: 2.25rem;
      padding: 0.5rem 0.65rem;
      justify-content: center;
      align-items: center;
      border-radius: 0;
      background: #fff;
      color: #111827;
      font-size: 0.8rem;
      font-weight: 700;
      text-align: center;
    }

    .calendar-day-other-month {
      color: #6b7280;
      background: #eef2f7;
    }

    .calendar-day-today {
      background: #eaf1ff;
      color: #1d4ed8;
      font-weight: 700;
    }

    .calendar-day-selected {
      background: #cfe0ff;
      color: #0f172a;
      box-shadow: inset 0 0 0 1px #93c5fd;
    }

    .calendar-day:not(.calendar-day-header):hover {
      background: #f8fbff;
    }

    .calendar-day-selected:hover {
      background: #c7dbff;
    }

    .calendar-day-number {
      line-height: 1;
    }

    .event-dot {
      position: absolute;
      bottom: 0.55rem;
      left: 0.55rem;
      width: 0.35rem;
      height: 0.35rem;
      border-radius: 50%;
      background: #111827;
    }

    .calendar-side-title {
      margin-bottom: 0.55rem;
      color: #14213d;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .calendar-selected-date {
      margin-bottom: 1rem;
      color: #546276;
      font-size: 0.92rem;
    }

    .event-list {
      width: 100%;
      display: grid;
      gap: 0.55rem;
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .calendar-sidebar .calendar-side-card:last-child .event-list {
      max-height: 14.5rem;
      overflow-y: auto;
      padding-right: 0.35rem;
    }

    .calendar-sidebar .calendar-side-card:last-child .event-list::-webkit-scrollbar {
      width: 0.45rem;
    }

    .calendar-sidebar .calendar-side-card:last-child .event-list::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 999px;
    }

    .calendar-sidebar .calendar-side-card:last-child .event-list::-webkit-scrollbar-track {
      background: #f8fafc;
      border-radius: 999px;
    }

    .event-item {
      display: flex;
      align-items: flex-start;
      padding: 0.72rem 0.8rem;
      background: #f8fafc;
      border: 1px solid #ecf0f7;
      border-radius: 14px;
    }

    .event-title {
      color: #14213d;
      font-weight: 700;
    }

    .event-date {
      color: #64748b;
      font-size: 0.82rem;
      white-space: nowrap;
    }

    .event-copy {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }

    .event-title-link {
      align-self: flex-start;
      padding: 0;
      border: 0;
      background: transparent;
      color: #3730a3;
      font-size: 0.9rem;
      font-weight: 700;
      text-align: left;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 0.16em;
    }

    .event-title-link:hover,
    .event-title-link:focus-visible {
      color: #4f46e5;
    }

    .calendar-empty-copy {
      margin: 0;
      color: #7b8798;
      font-size: 0.88rem;
    }

    @media (max-width: 980px) {
      .calendar-layout {
        grid-template-columns: 1fr;
      }

      .calendar-toolbar-primary {
        grid-template-columns: 1fr;
        justify-items: stretch;
      }

      .calendar-month-label {
        justify-self: flex-start;
      }

      .calendar-toolbar-group-end {
        justify-content: flex-start;
      }
    }

    @media (max-width: 720px) {
      .calendar-shell {
        padding: 1rem;
        border-radius: 22px;
      }

      .calendar-hero,
      .calendar-toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .calendar-summary-chip {
        align-self: flex-start;
      }

      .calendar-panel,
      .calendar-side-card {
        padding: 1rem;
        border-radius: 20px;
      }

      .calendar-day {
        min-height: 3.6rem;
        font-size: 0.92rem;
      }

      .event-item {
        flex-direction: column;
      }

      .event-date {
        white-space: normal;
      }
    }
  `],
})
export class StudentCalendarComponent {
  readonly studentData = inject(StudentDataService);
  readonly events = this.studentData.calendarEvents;

  readonly weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  readonly today = new Date();
  readonly currentMonth = signal(this.today.getMonth());
  readonly currentYear = signal(this.today.getFullYear());
  readonly selectedDay = signal(new Date(this.today));
  readonly calendarDays = signal<CalendarDay[]>([]);
  readonly visibleMonthLabel = computed(
    () => `${this.monthNames[this.currentMonth()]} ${this.currentYear()}`
  );
  readonly selectedDayEvents = computed(() =>
    this.events().filter((event) => this.isSameDay(event.date, this.selectedDay()))
  );
  readonly upcomingEvents = computed(() =>
    [...this.events()]
      .filter((event) => event.date >= this.stripTime(this.today))
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(0, 5)
  );

  constructor() {
    this.generateCalendar();
  }

  generateCalendar() {
    const days: CalendarDay[] = [];
    const firstDayOfMonth = new Date(this.currentYear(), this.currentMonth(), 1);
    const lastDayOfMonth = new Date(this.currentYear(), this.currentMonth() + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const previousMonthLastDay = new Date(this.currentYear(), this.currentMonth(), 0);

    for (let index = 0; index < startDay; index += 1) {
      days.push({
        date: new Date(
          this.currentYear(),
          this.currentMonth() - 1,
          previousMonthLastDay.getDate() - startDay + index + 1,
        ),
        inCurrentMonth: false,
      });
    }

    for (let dayNumber = 1; dayNumber <= lastDayOfMonth.getDate(); dayNumber += 1) {
      days.push({
        date: new Date(this.currentYear(), this.currentMonth(), dayNumber),
        inCurrentMonth: true,
      });
    }

    let nextMonthDay = 1;
    while (days.length % 7 !== 0) {
      days.push({
        date: new Date(this.currentYear(), this.currentMonth() + 1, nextMonthDay),
        inCurrentMonth: false,
      });
      nextMonthDay += 1;
    }

    this.calendarDays.set(days);
  }

  prevMonth() {
    if (this.currentMonth() === 0) {
      this.currentMonth.set(11);
      this.currentYear.update((year) => year - 1);
    } else {
      this.currentMonth.update((month) => month - 1);
    }

    this.generateCalendar();
  }

  nextMonth() {
    if (this.currentMonth() === 11) {
      this.currentMonth.set(0);
      this.currentYear.update((year) => year + 1);
    } else {
      this.currentMonth.update((month) => month + 1);
    }

    this.generateCalendar();
  }

  goToToday() {
    this.currentMonth.set(this.today.getMonth());
    this.currentYear.set(this.today.getFullYear());
    this.selectedDay.set(new Date(this.today));
    this.generateCalendar();
  }

  isToday(day: CalendarDay) {
    return !!day.date && day.inCurrentMonth && this.isSameDay(day.date, this.today);
  }

  isSelected(day: CalendarDay) {
    return !!day.date && day.inCurrentMonth && this.isSameDay(day.date, this.selectedDay());
  }

  selectDay(day: CalendarDay) {
    if (!day.inCurrentMonth) {
      this.currentMonth.set(day.date.getMonth());
      this.currentYear.set(day.date.getFullYear());
      this.generateCalendar();
    }

    this.selectedDay.set(new Date(day.date));
  }

  hasEvents(date: Date) {
    return this.events().some((event) => this.isSameDay(event.date, date));
  }

  openEvent(event: StudentCalendarEvent) {
    this.studentData.openCalendarEvent(event);
  }

  private isSameDay(left: Date, right: Date) {
    return left.getDate() === right.getDate()
      && left.getMonth() === right.getMonth()
      && left.getFullYear() === right.getFullYear();
  }

  private stripTime(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
