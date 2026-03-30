import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificationService, Notification } from './notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe],
  template: `
    <h2>Notifications</h2>
    <button (click)="markAllRead()">Mark All as Read</button>
    <table border="1" cellpadding="4" style="margin-top:1rem; width:100%; max-width:700px;">
      <tr><th>Status</th><th>Type</th><th>Message</th><th>Date</th><th>Action</th></tr>
      <tr *ngFor="let n of notifications">
        <td>
          <span *ngIf="n.read" style="color:green;">Read</span>
          <span *ngIf="!n.read" style="color:red;">Unread</span>
        </td>
        <td>{{ n.type }}</td>
        <td>{{ n.message }}</td>
        <td>{{ n.createdAt | date:'short' }}</td>
        <td>
          <button *ngIf="!n.read" (click)="markRead(n.id)">Mark as Read</button>
        </td>
      </tr>
    </table>
  `,
  providers: [NotificationService],
})
export class NotificationsComponent {
  currentUserId = 1; // Simulate logged-in user
  notifications: Notification[] = [];

  constructor(public notificationService: NotificationService) {
    this.refresh();
  }

  refresh() {
    this.notifications = this.notificationService.getForUser(this.currentUserId);
  }

  markRead(id: number) {
    this.notificationService.markRead(id);
    this.refresh();
  }

  markAllRead() {
    this.notificationService.markAllRead(this.currentUserId);
    this.refresh();
  }
}