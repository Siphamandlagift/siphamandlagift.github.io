import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService, UserWithProfile } from '../user.service';

@Component({
  selector: 'app-user-edit',
  standalone: true,
  template: `
    <h2>Edit User</h2>
    <form *ngIf="user" (ngSubmit)="onSave()" #editForm="ngForm" style="max-width:300px;">
      <div>
        <label>Username:</label>
        <input name="username" [(ngModel)]="user.username" required />
      </div>
      <div>
        <label>Role:</label>
        <select name="role" [(ngModel)]="user.role" required>
          <option value="Admin">Admin</option>
          <option value="TrainingManager">TrainingManager</option>
          <option value="Student">Student</option>
        </select>
      </div>
      <div>
        <label>Profile Picture:</label>
        <input type="file" (change)="onProfilePic($event)" />
        <img *ngIf="user.profilePic" [src]="user.profilePic" alt="Profile" width="32" height="32" />
      </div>
      <button type="submit">Save</button>
      <button type="button" (click)="cancel()">Cancel</button>
    </form>
    <div *ngIf="!user">User not found.</div>
  `,
  imports: [CommonModule, FormsModule],
})
export class UserEditComponent {
  user: UserWithProfile | undefined;
  constructor(private route: ActivatedRoute, private userService: UserService, private router: Router) {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.user = this.userService.getUser(id) ? { ...this.userService.getUser(id)! } : undefined;
  }

  onSave() {
    if (this.user) {
      this.userService.updateUser(this.user);
      this.router.navigate(['/users']);
    }
  }

  cancel() {
    this.router.navigate(['/users']);
  }

  onProfilePic(event: any) {
    const file = event.target.files[0];
    if (file && this.user) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.user!.profilePic = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
}