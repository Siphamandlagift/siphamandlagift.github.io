import { Component, inject, signal } from '@angular/core';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications {
  private readonly notificationService = inject(NotificationService);
  readonly currentUser = 'Jane Doe'; // TODO: Replace with real user
  readonly notifications = signal(this.notificationService.getNotificationsForUser(this.currentUser));

  markAsRead(id: number) {
    this.notificationService.markAsRead(id);
    this.notifications.set(this.notificationService.getNotificationsForUser(this.currentUser));
  }
}
