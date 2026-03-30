import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService, UserWithProfile } from '../user.service';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
// ...existing code...
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatCardModule],
  template: `
    <mat-card>
      <h2>User Management</h2>
      <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
        <button mat-raised-button color="primary" (click)="showAdd = !showAdd">{{ showAdd ? 'Cancel' : 'Add User' }}</button>
        <input type="file" (change)="onBulkUpload($event)" accept=".csv" />
      </div>
      <table mat-table [dataSource]="userService.users()" class="mat-elevation-z2" style="width:100%; max-width:700px;">
        <ng-container matColumnDef="username">
          <th mat-header-cell *matHeaderCellDef> Username </th>
          <td mat-cell *matCellDef="let user"> {{ user.username }} </td>
        </ng-container>
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef> Role </th>
          <td mat-cell *matCellDef="let user"> {{ user.role }} </td>
        </ng-container>
        <ng-container matColumnDef="profilePic">
          <th mat-header-cell *matHeaderCellDef> Profile Pic </th>
          <td mat-cell *matCellDef="let user">
            <img *ngIf="user.profilePic" [src]="user.profilePic" alt="Profile" width="32" height="32" style="border-radius:50%;" />
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef> Actions </th>
          <td mat-cell *matCellDef="let user">
            <button mat-button color="accent" (click)="editUser(user.id)">Edit</button>
            <button mat-button color="warn" (click)="deleteUser(user.id)">Delete</button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="['username','role','profilePic','actions']"></tr>
        <tr mat-row *matRowDef="let row; columns: ['username','role','profilePic','actions'];"></tr>
      </table>
    </mat-card>
    <mat-card *ngIf="showAdd" style="margin-top:1rem; max-width:400px;">
      <h3>Add User</h3>
      <form (ngSubmit)="onAdd()" #addForm="ngForm">
        <mat-form-field appearance="fill" style="width:100%;">
          <mat-label>Username</mat-label>
          <input matInput name="username" [(ngModel)]="newUser.username" required />
        </mat-form-field>
        <mat-form-field appearance="fill" style="width:100%;">
          <mat-label>Role</mat-label>
          <mat-select name="role" [(ngModel)]="newUser.role" required>
            <mat-option value="Admin">Admin</mat-option>
            <mat-option value="TrainingManager">TrainingManager</mat-option>
            <mat-option value="Student">Student</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="fill" style="width:100%;">
          <mat-label>Profile Picture</mat-label>
          <input type="file" (change)="onProfilePic($event)" />
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit">Add</button>
      </form>
    </mat-card>
  `
})
export class UserListComponent {
  showAdd = false;
  newUser: Partial<UserWithProfile> = { username: '', role: 'Student' };
  constructor(public userService: UserService, private router: Router) {}

  onAdd() {
    if (this.newUser.username && this.newUser.role) {
      this.userService.addUser(this.newUser as UserWithProfile);
      this.newUser = { username: '', role: 'Student' };
      this.showAdd = false;
    }
  }

  editUser(id: number) {
    this.router.navigate(['/users/edit', id]);
  }

  deleteUser(id: number) {
    this.userService.deleteUser(id);
  }

  onProfilePic(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.newUser.profilePic = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onBulkUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      const lines = text.split('\n').filter((l: string) => l.trim());
      const users: UserWithProfile[] = lines.map((line: string) => {
        const [username, role] = line.split(',');
        return { id: 0, username: username.trim(), role: (role?.trim() || 'Student') as any };
      });
      this.userService.bulkAdd(users);
    };
    reader.readAsText(file);
  }
}