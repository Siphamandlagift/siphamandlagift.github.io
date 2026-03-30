import { Injectable, signal, inject } from '@angular/core';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationService } from '../notifications/notification.service';

export interface QuizQuestion {
  id: number;
  section: string;
  question: string;
  options: string[];
  answer: string;
  userAnswers: { [userId: number]: string };
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private _questions = signal<QuizQuestion[]>([
    { id: 1, section: 'Introduction', question: 'Angular is a ___?', options: ['Framework', 'Library', 'Language'], answer: 'Framework', userAnswers: {} },
    { id: 2, section: 'Components', question: 'Which decorator defines a component?', options: ['@NgModule', '@Component', '@Injectable'], answer: '@Component', userAnswers: {} }
  ]);
  questions = this._questions.asReadonly();

  private gamificationService = inject(GamificationService);
  private notificationService = inject(NotificationService);

  submitAnswer(qid: number, userId: number, answer: string) {
    this._questions.update(qs => qs.map(q => q.id === qid ? { ...q, userAnswers: { ...q.userAnswers, [userId]: answer } } : q));
    // After submitting, check if user has answered all questions correctly
    const allCorrect = this._questions().every(q => q.userAnswers[userId] && q.userAnswers[userId] === q.answer);
    if (allCorrect && this._questions().length > 0) {
      // Award 'Quiz Master' badge and points
      this.gamificationService.awardBadge(userId, 3); // 3 = Quiz Master
      this.gamificationService.addPoints(userId, 50);
      // Send notification
      this.notificationService.send(userId, 'Congratulations! You scored 100% on a quiz!', 'success');
    }
  }

  getUserAnswer(qid: number, userId: number): string {
    return this._questions().find(q => q.id === qid)?.userAnswers[userId] ?? '';
  }

  isCorrect(qid: number, userId: number): boolean {
    const q = this._questions().find(q => q.id === qid);
    return q ? q.userAnswers[userId] === q.answer : false;
  }
}
