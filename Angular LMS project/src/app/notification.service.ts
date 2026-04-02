import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  user: string;
  message: string;
  timestamp: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notifications = signal<Notification[]>([]);
  private nextId = 1;

  notify(user: string, message: string) {
    const notif: Notification = {
      id: this.nextId++,
      user,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.notifications.update(list => [...list, notif]);
  }

  getNotificationsForUser(user: string) {
    return this.notifications().filter(n => n.user === user);
  }

  markAsRead(id: number) {
    this.notifications.update(list => list.map(n => n.id === id ? { ...n, read: true } : n));
  }
}
