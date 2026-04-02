import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-manager-profile',
  standalone: true,
  templateUrl: './manager-profile.html',
  styleUrl: './manager-profile.css',
})
export class ManagerProfile {
  readonly manager = signal({
    name: 'Samuel Mokoena',
    email: 'samuel.mokoena@lms.com',
    managedCourses: [
      'Leadership Training',
      'Agile Project Management',
      'Team Communication Skills',
    ],
  });
}
