import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyService, Company } from '../company.service';
import { UserService, UserWithProfile } from '../../users/user.service';

@Component({
  selector: 'app-company-list',
  standalone: true,
  template: `
    <h2>Company Management</h2>
    <button (click)="showAdd = !showAdd">{{ showAdd ? 'Cancel' : 'Add Company' }}</button>
    <table border="1" cellpadding="4" style="margin-top:1rem; width:100%; max-width:600px;">
      <tr><th>Name</th><th>Users</th><th>Actions</th></tr>
      <tr *ngFor="let company of companyService.companies()">
        <td>{{ company.name }}</td>
        <td>
          <span *ngFor="let uid of company.users">
            {{ getUserName(uid) }}<button (click)="removeUser(company.id, uid)">x</button>&nbsp;
          </span>
        </td>
        <td>
          <button (click)="editCompany(company)">Edit</button>
          <button (click)="deleteCompany(company.id)">Delete</button>
          <button (click)="assignUserPrompt(company.id)">Assign User</button>
        </td>
      </tr>
    </table>
    <div *ngIf="showAdd" style="margin-top:1rem;">
      <h3>Add Company</h3>
      <form (ngSubmit)="onAdd()" #addForm="ngForm">
        <input name="name" [(ngModel)]="newCompany.name" placeholder="Company Name" required />
        <button type="submit">Add</button>
      </form>
    </div>
    <div *ngIf="editing" style="margin-top:1rem;">
      <h3>Edit Company</h3>
      <form (ngSubmit)="onSaveEdit()" #editForm="ngForm">
        <input name="name" [(ngModel)]="editing.name" required />
        <button type="submit">Save</button>
        <button type="button" (click)="editing = undefined">Cancel</button>
      </form>
    </div>
    <div *ngIf="assigningCompanyId !== null" style="margin-top:1rem;">
      <h3>Assign User to Company</h3>
      <select [(ngModel)]="selectedUserId">
        <option *ngFor="let user of userService.users()" [value]="user.id">{{ user.username }}</option>
      </select>
      <button (click)="assignUser(assigningCompanyId, selectedUserId)">Assign</button>
      <button (click)="assigningCompanyId = null">Cancel</button>
    </div>
  `,
  imports: [CommonModule, FormsModule],
})
export class CompanyListComponent {
  showAdd = false;
  newCompany: Partial<Company> = { name: '' };
  editing: Company | undefined;
  assigningCompanyId: number | null = null;
  selectedUserId: number | null = null;
  constructor(public companyService: CompanyService, public userService: UserService) {}

  onAdd() {
    if (this.newCompany.name) {
      this.companyService.addCompany({ name: this.newCompany.name, users: [] });
      this.newCompany = { name: '' };
      this.showAdd = false;
    }
  }

  editCompany(company: Company) {
    this.editing = { ...company };
  }

  onSaveEdit() {
    if (this.editing) {
      this.companyService.updateCompany(this.editing);
      this.editing = undefined;
    }
  }

  deleteCompany(id: number) {
    this.companyService.deleteCompany(id);
  }

  assignUserPrompt(companyId: number) {
    this.assigningCompanyId = companyId;
    this.selectedUserId = null;
  }

  assignUser(companyId: number, userId: number | null) {
    if (userId) {
      this.companyService.assignUser(companyId, userId);
      this.assigningCompanyId = null;
    }
  }

  removeUser(companyId: number, userId: number) {
    this.companyService.removeUser(companyId, userId);
  }

  getUserName(id: number): string {
    const user = this.userService.users().find(u => u.id === id);
    return user ? user.username : 'Unknown';
  }
}