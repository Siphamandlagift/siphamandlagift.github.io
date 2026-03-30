import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  template: `
    <h2>Forgot Password</h2>
    <form (ngSubmit)="onSubmit()" #forgotForm="ngForm" style="max-width:300px;">
      <div>
        <label>Username:</label>
        <input name="username" [(ngModel)]="username" required />
      </div>
      <div *ngIf="message" style="color:green;">{{ message }}</div>
      <div *ngIf="error" style="color:red;">{{ error }}</div>
      <button type="submit">Send Reset Link</button>
    </form>
    <div style="margin-top:1rem;">
      <a routerLink="/auth/login">Back to login</a>
    </div>
  `,
  imports: [CommonModule, FormsModule],
})
export class ForgotPasswordComponent {
  username = '';
  message = '';
  error = '';
  onSubmit() {
    // Simulate sending reset link
    if (this.username.trim()) {
      this.message = 'If this username exists, a reset link has been sent.';
      this.error = '';
    } else {
      this.error = 'Please enter your username.';
      this.message = '';
    }
  }
}