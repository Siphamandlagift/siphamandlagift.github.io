import { Component, signal, inject } from '@angular/core';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UserService } from './user.service';

@Component({
  selector: 'app-user-create',
  standalone: true,
  templateUrl: './user-create.html',
  styleUrl: './user-create.css',
  imports: [ReactiveFormsModule],
})
export class UserCreate {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  readonly submitted = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  readonly userForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['student', [Validators.required]]
  });

  get name() { return this.userForm.get('name'); }
  get email() { return this.userForm.get('email'); }
  get role() { return this.userForm.get('role'); }

  onSubmit() {
    this.submitted.set(true);
    this.error.set(null);
    if (this.userForm.valid) {
      this.loading.set(true);
      this.userService.createUser(this.userForm.value).subscribe({
        next: () => {
          this.success.set(true);
          this.userForm.reset({ role: 'student' });
          this.submitted.set(false);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to create user. Please try again.');
          this.loading.set(false);
        }
      });
    }
  }
}
