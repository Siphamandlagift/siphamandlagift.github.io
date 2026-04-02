import { Component, signal } from '@angular/core';
import { AdminUserManagement } from './admin-user-management';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  templateUrl: './admin-profile.html',
  styleUrl: './admin-profile.css',
  imports: [AdminUserManagement],
})
export class AdminProfile {
  readonly admin = signal({
    name: 'Admin User',
    email: 'admin@lms.com',
    role: 'Administrator',
    permissions: [
      'Manage Users',
      'Manage Courses',
      'View Reports',
      'Send Notifications',
      'System Settings',
    ],
  });
}
