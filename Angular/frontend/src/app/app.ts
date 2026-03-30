import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { inject } from '@angular/core';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatToolbarModule, MatSidenavModule, MatListModule, MatIconModule, MatButtonModule],
  template: `
    <ng-container *ngIf="auth.isLoggedIn(); else loginOnly">
      <mat-toolbar color="primary">
        <button mat-icon-button (click)="drawer.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
        <span style="margin-left:1rem; font-weight:bold;">SkillsConnect LMS</span>
      </mat-toolbar>
      <mat-sidenav-container style="min-height:100vh;">
        <mat-sidenav #drawer mode="side" opened>
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard"><mat-icon>dashboard</mat-icon> Dashboard</a>
            <a mat-list-item routerLink="/users"><mat-icon>group</mat-icon> Users</a>
            <a mat-list-item routerLink="/companies"><mat-icon>business</mat-icon> Companies</a>
            <a mat-list-item routerLink="/courses"><mat-icon>school</mat-icon> Courses</a>
            <a mat-list-item routerLink="/progress"><mat-icon>trending_up</mat-icon> Progress</a>
            <a mat-list-item routerLink="/content"><mat-icon>menu_book</mat-icon> Content</a>
            <a mat-list-item routerLink="/assessments"><mat-icon>assignment</mat-icon> Assessments</a>
            <a mat-list-item routerLink="/assignments"><mat-icon>assignment_turned_in</mat-icon> Assignments</a>
            <a mat-list-item routerLink="/certificates"><mat-icon>emoji_events</mat-icon> Certificates</a>
            <a mat-list-item routerLink="/gamification"><mat-icon>military_tech</mat-icon> Gamification</a>
            <a mat-list-item routerLink="/notifications"><mat-icon>notifications</mat-icon> Notifications</a>
            <a mat-list-item routerLink="/reporting"><mat-icon>bar_chart</mat-icon> Reporting</a>
          </mat-nav-list>
        </mat-sidenav>
        <mat-sidenav-content style="padding:2rem;">
          <router-outlet></router-outlet>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </ng-container>
    <ng-template #loginOnly>
      <router-outlet></router-outlet>
    </ng-template>
  `,
  styleUrls: ['./app.material.scss']
})
export class App {
  protected readonly title = signal('SkillsConnect LMS');
  auth = inject(AuthService);
}
