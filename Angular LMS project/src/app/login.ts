import { Component, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  readonly fb = new FormBuilder();
  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly submitted = signal(false);
  readonly forgotPassword = signal(false);

  readonly email = computed(() => this.loginForm.get('email')!);
  readonly password = computed(() => this.loginForm.get('password')!);

  onSubmit() {
    this.submitted.set(true);
    if (this.loginForm.valid) {
      // TODO: Implement authentication logic
      alert('Login successful!');
    }
  }

  onForgotPassword() {
    this.forgotPassword.set(true);
  }
}
