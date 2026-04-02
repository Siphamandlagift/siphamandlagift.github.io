import { Injectable, signal } from '@angular/core';

export interface Message {
  id: number;
  sender: string;
  recipient: string;
  content: string;
  timestamp: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly messages = signal<Message[]>([]);
  private nextId = 1;

  sendMessage(sender: string, recipient: string, content: string) {
    const msg: Message = {
      id: this.nextId++,
      sender,
      recipient,
      content,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.messages.update(list => [...list, msg]);
  }

  getMessagesForUser(user: string) {
    return this.messages().filter(m => m.recipient === user);
  }

  markAsRead(id: number) {
    this.messages.update(list => list.map(m => m.id === id ? { ...m, read: true } : m));
  }
}
