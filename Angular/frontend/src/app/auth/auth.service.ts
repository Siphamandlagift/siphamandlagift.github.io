import { Injectable, signal } from '@angular/core';

export type UserRole = 'Admin' | 'TrainingManager' | 'Student';
export interface User {
  id: number;
  username: string;
  role: UserRole;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Simulated user database
  private users = [
    { id: 1, username: 'admin', password: 'admin', role: 'Admin' },
    { id: 2, username: 'manager', password: 'manager', role: 'TrainingManager' },
    { id: 3, username: 'student', password: 'student', role: 'Student' },
  ];

  private _currentUser = signal<User | null>(null);
  currentUser = this._currentUser.asReadonly();

  login(username: string, password: string): boolean {
    const found = this.users.find(u => u.username === username && u.password === password);
    if (found) {
      this._currentUser.set({ id: found.id, username: found.username, role: found.role as UserRole });
      return true;
    }
    return false;
  }

  logout() {
    this._currentUser.set(null);
  }

  isLoggedIn(): boolean {
    return this._currentUser() !== null;
  }

  getRole(): UserRole | null {
    return this._currentUser()?.role ?? null;
  }
}
