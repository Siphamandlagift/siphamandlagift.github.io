import { Injectable, signal } from '@angular/core';

export interface LearningContent {
  id: number;
  courseId: number;
  sectionId: number;
  type: 'video' | 'pdf' | 'document';
  title: string;
  url: string;
  completedBy: number[]; // user ids
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private _content = signal<LearningContent[]>([
    { id: 1, courseId: 1, sectionId: 1, type: 'video', title: 'Intro Video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', completedBy: [] },
    { id: 2, courseId: 1, sectionId: 2, type: 'pdf', title: 'Components PDF', url: 'https://example.com/sample.pdf', completedBy: [] }
  ]);
  content = this._content.asReadonly();

  markCompleted(contentId: number, userId: number) {
    this._content.update(cs => cs.map(c => c.id === contentId ? { ...c, completedBy: [...new Set([...c.completedBy, userId])] } : c));
  }

  isCompleted(contentId: number, userId: number): boolean {
    return this._content().find(c => c.id === contentId)?.completedBy.includes(userId) ?? false;
  }
}
