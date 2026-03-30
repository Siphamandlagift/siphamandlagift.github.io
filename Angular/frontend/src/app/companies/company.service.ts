import { Injectable, signal } from '@angular/core';
import { UserWithProfile } from '../users/user.service';

export interface Company {
  id: number;
  name: string;
  users: number[]; // user ids
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private _companies = signal<Company[]>([
    { id: 1, name: 'Acme Corp', users: [1, 2] },
    { id: 2, name: 'Beta Ltd', users: [3] },
  ]);
  companies = this._companies.asReadonly();

  addCompany(company: Omit<Company, 'id'>) {
    this._companies.update(cs => [...cs, { ...company, id: Date.now() }]);
  }

  updateCompany(company: Company) {
    this._companies.update(cs => cs.map(c => c.id === company.id ? company : c));
  }

  deleteCompany(id: number) {
    this._companies.update(cs => cs.filter(c => c.id !== id));
  }

  getCompany(id: number): Company | undefined {
    return this._companies().find(c => c.id === id);
  }

  assignUser(companyId: number, userId: number) {
    this._companies.update(cs => cs.map(c => c.id === companyId ? { ...c, users: [...new Set([...c.users, userId])] } : c));
  }

  removeUser(companyId: number, userId: number) {
    this._companies.update(cs => cs.map(c => c.id === companyId ? { ...c, users: c.users.filter(id => id !== userId) } : c));
  }
}
