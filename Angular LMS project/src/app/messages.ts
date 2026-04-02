import { Component, inject, signal } from '@angular/core';
import { MessageService } from './message.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class Messages {
  private readonly messageService = inject(MessageService);
  readonly currentUser = 'Jane Doe'; // TODO: Replace with real user
  readonly recipient = signal('');
  readonly content = signal('');
  readonly messages = signal(this.messageService.getMessagesForUser(this.currentUser));

  sendMessage() {
    if (this.recipient() && this.content()) {
      this.messageService.sendMessage(this.currentUser, this.recipient(), this.content());
      this.content.set('');
      this.messages.set(this.messageService.getMessagesForUser(this.currentUser));
    }
  }

  markAsRead(id: number) {
    this.messageService.markAsRead(id);
    this.messages.set(this.messageService.getMessagesForUser(this.currentUser));
  }
}
