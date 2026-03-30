import { Injectable, signal } from '@angular/core';

export interface CourseSection {
  id: number;
  title: string;
  description: string;
}

export interface Course {
  id: number;
  name: string;
  description: string;
  sections: CourseSection[];
  progress: number; // percent
}

@Injectable({ providedIn: 'root' })
export class CourseService {
  private _courses = signal<Course[]>([
    { id: 1, name: 'Angular Basics', description: 'Learn Angular fundamentals.', sections: [
      { id: 1, title: 'Introduction', description: 'Intro to Angular' },
      { id: 2, title: 'Components', description: 'Angular Components' }
    ], progress: 0 },
    { id: 2, name: 'Advanced Angular', description: 'Deep dive into Angular.', sections: [], progress: 0 }
  ]);
  courses = this._courses.asReadonly();

  addCourse(course: Omit<Course, 'id'>) {
    this._courses.update(cs => [...cs, { ...course, id: Date.now() }]);
  }

  updateCourse(course: Course) {
    this._courses.update(cs => cs.map(c => c.id === course.id ? course : c));
  }

  deleteCourse(id: number) {
    this._courses.update(cs => cs.filter(c => c.id !== id));
  }

  getCourse(id: number): Course | undefined {
    return this._courses().find(c => c.id === id);
  }
}
