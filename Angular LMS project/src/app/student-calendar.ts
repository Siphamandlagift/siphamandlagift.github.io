import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-student-calendar',
  standalone: true,
  templateUrl: './student-calendar.html',
  styleUrl: './student-calendar.css',
})
export class StudentCalendar {
  readonly today = new Date();
  readonly month = this.today.toLocaleString('default', { month: 'long' });
  readonly year = this.today.getFullYear();
  readonly daysInMonth = new Date(this.year, this.today.getMonth() + 1, 0).getDate();
  readonly firstDay = new Date(this.year, this.today.getMonth(), 1).getDay();

  // Example: highlight some activity days
  readonly activityDays = signal([2, 5, 10, 15, 22]);
}
