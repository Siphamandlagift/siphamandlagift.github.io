import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UserService, User } from './user.service';

@Component({
  selector: 'app-admin-user-management',
  standalone: true,
  templateUrl: './admin-user-management.html',
  styleUrl: './admin-user-management.css',
  imports: [ReactiveFormsModule],
})
export class AdminUserManagement {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  readonly users = signal<User[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly progress = signal(0);
  readonly editingUser = signal<User | null>(null);

  readonly userForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    surname: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    idNumber: ['', [Validators.required, Validators.pattern(/^\d{6,}$/)]],
    company: ['', [Validators.required]],
    role: ['student', [Validators.required]],
    profilePicture: [null],
  });

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.userService.getUsers().subscribe({
      next: users => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.error.set('Failed to load users.');
        this.loading.set(false);
      }
    });
  }

  submitUser() {
    this.error.set(null);
    this.success.set(null);
    if (this.userForm.valid) {
      this.loading.set(true);
      const user = this.userForm.value;
      this.userService.createUser(user).subscribe({
        next: () => {
          this.success.set('User added successfully!');
          this.userForm.reset({ role: 'student' });
          this.loadUsers();
          this.loading.set(false);
        },
        error: (err: any) => {
          this.error.set('Failed to add user.');
          this.loading.set(false);
        }
      });
    } else {
      this.error.set('Please fill all required fields correctly.');
    }
  }

  editUser(user: User) {
    this.editingUser.set(user);
    this.userForm.patchValue(user);
  }

  updateUser() {
    if (this.userForm.valid && this.editingUser()) {
      this.loading.set(true);
      const user = { ...this.editingUser(), ...this.userForm.value };
      this.userService.updateUser(user).subscribe({
        next: () => {
          this.success.set('User updated successfully!');
          this.editingUser.set(null);
          this.userForm.reset({ role: 'student' });
          this.loadUsers();
          this.loading.set(false);
        },
        error: (err: any) => {
          this.error.set('Failed to update user.');
          this.loading.set(false);
        }
      });
    }
  }

  deleteUser(user: User) {
    if (confirm('Are you sure you want to delete this user?')) {
      this.loading.set(true);
      this.userService.deleteUser(user).subscribe({
        next: () => {
          this.success.set('User deleted successfully!');
          this.loadUsers();
          this.loading.set(false);
        },
        error: (err: any) => {
          this.error.set('Failed to delete user.');
          this.loading.set(false);
        }
      });
    }
  }

  handleFileInput(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.userForm.patchValue({ profilePicture: file });
    }
  }

  // Bulk upload CSV
  bulkUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.progress.set(0);
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    // Simulate CSV parsing and upload
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      const rows = text.split('\n').filter(Boolean);
      let uploaded = 0;
      rows.forEach((row: string, idx: number) => {
        const [name, surname, email, idNumber, company, role] = row.split(',');
        if (name && surname && email && idNumber && company && role) {
          this.userService.createUser({ name, surname, email, idNumber, company, role: role as User['role'], profilePicture: null }).subscribe({
            next: () => {
              uploaded++;
              this.progress.set(Math.round((uploaded / rows.length) * 100));
              if (uploaded === rows.length) {
                this.success.set('Bulk upload complete!');
                this.loadUsers();
                this.loading.set(false);
              }
            },
            error: () => {
              this.error.set(`Error uploading user: ${email}`);
              this.loading.set(false);
            }
          });
        } else {
          this.error.set('Invalid CSV row: ' + row);
          this.loading.set(false);
        }
      });
    };
    reader.onerror = () => {
      this.error.set('Failed to read CSV file.');
      this.loading.set(false);
    };
    reader.readAsText(file);
  }
}
