import { Injectable } from '@angular/core';

export interface Notification {
  id: number;
  userId: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications: Notification[] = [];

  send(userId: number, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    this.notifications.push({
      id: this.notifications.length + 1,
      userId,
      message,
      type,
      createdAt: new Date().toISOString(),
      read: false
    });
  }

  getForUser(userId: number): Notification[] {
    return this.notifications.filter(n => n.userId === userId);
  }

  markRead(notificationId: number) {
    const n = this.notifications.find(n => n.id === notificationId);
    if (n) n.read = true;
  }

  markAllRead(userId: number) {
    this.notifications.forEach(n => { if (n.userId === userId) n.read = true; });
  }
}
