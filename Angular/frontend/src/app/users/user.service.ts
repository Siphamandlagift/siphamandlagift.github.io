import { Injectable, signal } from '@angular/core';
import { User, UserRole } from '../auth/auth.service';

export interface UserWithProfile extends User {
  profilePic?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private _users = signal<UserWithProfile[]>([
    { id: 1, username: 'admin', role: 'Admin', profilePic: '' },
    { id: 2, username: 'manager', role: 'TrainingManager', profilePic: '' },
    { id: 3, username: 'student', role: 'Student', profilePic: '' },
  ]);
  users = this._users.asReadonly();

  addUser(user: UserWithProfile) {
    this._users.update(users => [...users, { ...user, id: Date.now() }]);
  }

  updateUser(user: UserWithProfile) {
    this._users.update(users => users.map(u => u.id === user.id ? user : u));
  }

  deleteUser(id: number) {
    this._users.update(users => users.filter(u => u.id !== id));
  }

  getUser(id: number): UserWithProfile | undefined {
    return this._users().find(u => u.id === id);
  }

  bulkAdd(users: UserWithProfile[]) {
    this._users.update(existing => [...existing, ...users.map(u => ({ ...u, id: Date.now() + Math.random() }))]);
  }
}
