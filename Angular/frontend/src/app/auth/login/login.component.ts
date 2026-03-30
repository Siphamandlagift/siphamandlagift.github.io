import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <h2>Login</h2>
    <form (ngSubmit)="onLogin()" #loginForm="ngForm" style="max-width:300px;">
      <div>
        <label>Username:</label>
        <input name="username" [(ngModel)]="username" required />
      </div>
      <div>
        <label>Password:</label>
        <input name="password" type="password" [(ngModel)]="password" required />
      </div>
      <div *ngIf="error" style="color:red;">{{ error }}</div>
      <button type="submit">Login</button>
    </form>
    <div style="margin-top:1rem;">
      <a routerLink="/auth/forgot-password">Forgot password?</a>
    </div>
  `,
  imports: [CommonModule, FormsModule],
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  constructor(private auth: AuthService, private router: Router) {}

  onLogin() {
    if (this.auth.login(this.username, this.password)) {
      this.error = '';
      // Redirect based on role
      const role = this.auth.getRole();
      if (role === 'Admin') this.router.navigate(['/users']);
      else if (role === 'TrainingManager') this.router.navigate(['/courses']);
      else this.router.navigate(['/courses']);
    } else {
      this.error = 'Invalid username or password';
    }
  }
}