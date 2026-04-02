import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.css',
})
export class StudentDashboard {
  readonly summary = signal({
    coursesEnrolled: 3,
    completedLessons: 12,
    totalLessons: 20,
    lastLogin: '2026-03-30',
    badges: 2,
  });
}
