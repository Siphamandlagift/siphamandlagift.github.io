import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

export interface User {
  name: string;
  surname: string;
  email: string;
  idNumber: string;
  company: string;
  role: 'student' | 'manager' | 'provider' | 'admin';
  profilePicture?: File | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = 'https://your-backend-api.com/api/users'; // TODO: Set your real API URL here
  constructor(private readonly http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  createUser(user: User): Observable<User> {
    return this.http.post<User>(this.apiUrl, user).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  updateUser(user: User): Observable<User> {
    // Assumes user has a unique idNumber
    return this.http.put<User>(`${this.apiUrl}/${user.idNumber}`, user).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  deleteUser(user: User): Observable<void> {
    // Assumes user has a unique idNumber
    return this.http.delete<void>(`${this.apiUrl}/${user.idNumber}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }
}
