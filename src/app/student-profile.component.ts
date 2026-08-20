import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StudentDashboardComponent } from './student-dashboard.component';
import { StudentBadgesComponent } from './student-badges.component';
import { StudentCoursesComponent } from './student-courses.component';
import { StudentCalendarComponent } from './student-calendar-view.component';
import { StudentMessagesComponent } from './student-messages.component';
import { StudentProfileSettingsComponent } from './student-profile-settings.component';
import {
  StudentDataService,
  StudentMentorshipObjectives,
  StudentMentorshipObjectiveEntry,
  StudentMentorshipProfile,
  StudentMentorshipProgressEntry,
  StudentMentorshipProgressReport,
} from './student-data.service';
import { ExternalTrainingRequestRecord, StudentIdpEntry, StudentKpiEntry, StudentKpiScore, TrainingManagerDataService } from './training-manager-data.service';
import { LmsBackendService, type LoginRole } from './lms-backend.service';
import { LmsBrandingService, LmsBrandThemeOption } from './lms-branding.service';
import { clearLmsAuthSession, combineDisplayName, createLmsSessionRecord, readLmsSessionRecord } from './session-auth';

@Component({
  selector: 'student-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    StudentDashboardComponent,
    StudentBadgesComponent,
    StudentCoursesComponent,
    StudentCalendarComponent,
    StudentMessagesComponent,
    StudentProfileSettingsComponent,
  ],
  template: `
    <div
      class="profile-shell"
      [class.profile-shell-dialog-open]="mentorshipDialogOpen() || externalTrainingRequestDialogOpen() || externalTrainingStatusDialogOpen() || kpiFullScreen()"
      [style.--brand-primary]="studentTheme().primary"
      [style.--brand-secondary]="studentTheme().secondary"
      [style.--brand-tint]="studentTheme().tint"
      [style.--brand-surface]="studentTheme().surface">
      <div
        *ngIf="showWelcomeBanner()"
        class="welcome-banner"
        [class.welcome-banner-leaving]="welcomeBannerLeaving()"
        role="status"
        aria-live="polite">
        <div class="welcome-banner-title">Welcome back, {{ studentFirstName() }}</div>
        <div class="welcome-banner-copy">Your learning workspace is ready.</div>
      </div>

      <div
        *ngIf="externalTrainingSuccessPopupVisible()"
        class="submit-success-popup"
        [class.submit-success-popup-leaving]="externalTrainingSuccessPopupLeaving()"
        role="status"
        aria-live="polite">
        <div class="submit-success-popup-title">{{ externalTrainingSuccessPopupTitle() }}</div>
        <div class="submit-success-popup-copy">{{ externalTrainingSuccessPopupCopy() }}</div>
      </div>

      <header class="profile-topbar">
        <div class="topbar-brand">
          <span class="brand-mark" [class.brand-mark-has-image]="!!branding.companyLogoDataUrl()">
            <img *ngIf="branding.companyLogoDataUrl()" [src]="branding.companyLogoDataUrl()!" alt="" />
            <span *ngIf="!branding.companyLogoDataUrl()">S</span>
          </span>
          <div>
            <div class="brand-name">skillsconnect</div>
            <div class="brand-copy">Student learning workspace</div>
          </div>
        </div>

        <div class="topbar-icons">
          <div class="topbar-dropdown-wrap">
            <button class="icon-btn" [class.icon-btn-active]="topbarDropdown() === 'notifications'" aria-label="Notifications" [attr.aria-expanded]="topbarDropdown() === 'notifications'" (click)="toggleTopbarDropdown('notifications')">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="#64748b" d="M12 2a6 6 0 0 0-6 6v3.09c0 .36-.19.7-.5.88A3.01 3.01 0 0 0 4 15v1c0 .55.45 1 1 1h14a1 1 0 0 0 1-1v-1c0-1.13-.61-2.16-1.5-2.69-.31-.18-.5-.52-.5-.88V8a6 6 0 0 0-6-6Zm0 20a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 12 22Z"/></svg>
              <span *ngIf="studentData.unreadNotificationsCount()" class="icon-counter">{{ studentData.unreadNotificationsCount() }}</span>
            </button>

            <div *ngIf="topbarDropdown() === 'notifications'" class="profile-menu-panel" role="dialog" aria-label="Notifications summary">
              <div class="profile-menu-header">
                <div class="profile-menu-header-name">Notifications</div>
              </div>

              <div class="profile-menu-group">
                <div *ngIf="!recentNotifications().length" class="profile-menu-header-email">No recent notifications.</div>

                <div *ngFor="let notification of recentNotifications()" class="notif-item" [class.notif-item-unread]="notification.unread">
                  <button type="button" class="notif-item-body" (click)="handleNotificationClick(notification)">
                    <span class="notif-badge-row">
                      <span class="notif-badge">{{ notification.badge }}</span>
                      <span class="notif-date">{{ notification.dateLabel }}</span>
                      <span *ngIf="notification.unread" class="notif-unread-dot" aria-label="Unread"></span>
                    </span>
                    <strong class="notif-title">{{ notification.title }}</strong>
                    <span class="notif-body-text">{{ notification.body }}</span>
                  </button>
                  <button type="button" class="notif-dismiss-btn" aria-label="Dismiss notification" (click)="studentData.dismissNotification(notification.id)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="topbar-dropdown-wrap">
            <button class="icon-btn" [class.icon-btn-active]="topbarDropdown() === 'messages'" aria-label="Messages" [attr.aria-expanded]="topbarDropdown() === 'messages'" (click)="toggleTopbarDropdown('messages')">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="#64748b" d="M21 6.5a2.5 2.5 0 0 0-2.5-2.5h-13A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-11Zm-2.5-.5a.5.5 0 0 1 .5.5v.13l-7 4.67-7-4.67V6.5a.5.5 0 0 1 .5-.5h13ZM20 17.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V8.37l6.65 4.43a1 1 0 0 0 1.1 0L20 8.37v9.13Z"/></svg>
              <span *ngIf="studentData.unreadMessagesCount()" class="icon-counter">{{ studentData.unreadMessagesCount() }}</span>
            </button>

            <div *ngIf="topbarDropdown() === 'messages'" class="profile-menu-panel" role="dialog" aria-label="Messages summary">
              <div class="profile-menu-header">
                <div class="profile-menu-header-name">Messages</div>
              </div>

              <div class="profile-menu-group">
                <div *ngIf="!recentMessages().length" class="profile-menu-header-email">No recent messages.</div>

                <button *ngFor="let message of recentMessages()" type="button" class="profile-menu-item topbar-dropdown-item" (click)="openMessagesPanel()">
                  <strong [attr.title]="message.sender">{{ message.sender }}</strong>
                </button>
              </div>

              <div class="profile-menu-group profile-menu-group-bordered">
                <button type="button" class="profile-menu-item" (click)="openMessagesPanel()">View all messages</button>
              </div>
            </div>
          </div>
          <div class="profile-menu-wrap">
            <button
              class="profile-menu-trigger"
              [class.profile-menu-trigger-active]="profileMenuOpen()"
              aria-label="Open profile menu"
              aria-haspopup="menu"
              [attr.aria-expanded]="profileMenuOpen()"
              (click)="toggleProfileMenu()">
              <span class="topbar-profile-avatar" [class.topbar-profile-avatar-has-image]="!!profileImageSrc()" aria-hidden="true">
                <img *ngIf="profileImageSrc()" [src]="profileImageSrc()!" alt="" />
                <span *ngIf="!profileImageSrc()">{{ profileInitials() }}</span>
              </span>
              <span class="profile-menu-name">{{ studentData.profile().name }}</span>
              <svg class="profile-menu-caret" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div *ngIf="profileMenuOpen()" class="profile-menu-panel" role="menu" aria-label="Profile menu">
              <div class="profile-menu-header">
                <div class="profile-menu-header-name">{{ studentData.profile().name }}</div>
                <div class="profile-menu-header-email">{{ studentData.profile().email }}</div>
              </div>

              <div class="profile-menu-group">
                <button class="profile-menu-item" type="button" role="menuitem" (click)="openProfileMenuItem('profile')">
                  <span class="profile-menu-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.25" stroke="currentColor" stroke-width="1.8"/><path d="M6 19c0-2.67 2.69-4.25 6-4.25S18 16.33 18 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </span>
                  <span>My Profile</span>
                </button>
                <button class="profile-menu-item" type="button" role="menuitem" (click)="openProfileMenuItem('dashboard')">
                  <span class="profile-menu-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 10.5 12 4l8 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10v8h10v-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <span>Dashboard</span>
                </button>
              </div>

              <div *ngIf="availableSwitchRoles().length" class="profile-menu-group profile-menu-group-bordered">
                <div class="profile-menu-section-label">Switch role</div>
                <button *ngIf="availableSwitchRoles().includes('administrator')" class="profile-menu-item" type="button" role="menuitem" [disabled]="switchingRole()" (click)="switchToRole('administrator')">
                  <span class="profile-menu-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3.5 5 6.3v4.9c0 4.4 3 8.5 7 9.3 4-.8 7-4.9 7-9.3V6.3l-7-2.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.3 12.2l1.9 1.9 3.5-3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <span>Administrator</span>
                </button>
                <button *ngIf="availableSwitchRoles().includes('training-manager')" class="profile-menu-item" type="button" role="menuitem" [disabled]="switchingRole()" (click)="switchToRole('training-manager')">
                  <span class="profile-menu-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" fill="currentColor"/></svg>
                  </span>
                  <span>Training Manager</span>
                </button>
                <button *ngIf="availableSwitchRoles().includes('student')" class="profile-menu-item" type="button" role="menuitem" [disabled]="switchingRole()" (click)="switchToRole('student')">
                  <span class="profile-menu-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82ZM12 3 1 9l11 6 9-4.91V17h2V9L12 3Z" fill="currentColor"/></svg>
                  </span>
                  <span>Student</span>
                </button>
              </div>

              <div class="profile-menu-group profile-menu-group-bordered">
                <button class="profile-menu-item profile-menu-item-danger" type="button" role="menuitem" (click)="closeProfileMenu(); logout()">
                  <span class="profile-menu-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6h-4a4 4 0 1 0 0 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 12h7m0 0-2.5-2.5M20 12l-2.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <button *ngIf="topbarDropdown()" class="profile-menu-backdrop" type="button" aria-label="Close recent items" (click)="closeTopbarDropdown()"></button>
      <button *ngIf="profileMenuOpen()" class="profile-menu-backdrop" type="button" aria-label="Close profile menu" (click)="closeProfileMenu()"></button>

      <div class="profile-layout" [class.profile-layout-side-panel-collapsed]="sidePanelCollapsed()">
        <nav class="side-panel" [class.side-panel-collapsed]="sidePanelCollapsed()" [class.side-panel-scrolling]="sidebarScrolling()" (scroll)="onSidebarScroll()" aria-label="Student Navigation">
          <div class="side-panel-header">
            <button
              type="button"
              class="side-panel-toggle"
              [attr.aria-label]="sidePanelCollapsed() ? 'Expand navigation panel' : 'Collapse navigation panel'"
              [attr.aria-expanded]="!sidePanelCollapsed()"
              (click)="toggleSidePanel()">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 7.5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                <path d="M6 16.5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>

          <button [class.active]="selectedPanel() === 'dashboard'" (click)="selectPanel('dashboard')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="3.5" width="7" height="7" rx="2"></rect>
                <rect x="13.5" y="3.5" width="7" height="4.5" rx="2"></rect>
                <rect x="13.5" y="11" width="7" height="9.5" rx="2"></rect>
                <rect x="3.5" y="13.5" width="7" height="7" rx="2"></rect>
              </svg>
            </span>
            <span class="side-panel-label">Dashboard</span>
          </button>
          <button [class.active]="selectedPanel() === 'courses'" (click)="selectPanel('courses')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v13a1 1 0 0 1-1.52.85L12 16l-5.48 3.35A1 1 0 0 1 5 18.5v-13Z"></path>
                <path d="M8 7.5h8"></path>
                <path d="M8 10.5h6"></path>
              </svg>
            </span>
            <span class="side-panel-label">Courses</span>
          </button>
          <button [class.active]="selectedPanel() === 'external-training'" (click)="selectPanel('external-training')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M14 5h5v5"></path>
                <path d="M10 14 19 5"></path>
                <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"></path>
              </svg>
            </span>
            <span class="side-panel-label">Training Request</span>
          </button>
          <button [class.active]="selectedPanel() === 'mentorship'" (click)="selectPanel('mentorship')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
                <path d="M17 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"></path>
                <path d="M4.5 19a4.5 4.5 0 0 1 9 0"></path>
                <path d="M14 19a3.5 3.5 0 0 1 7 0"></path>
              </svg>
            </span>
            <span class="side-panel-label">Mentorship</span>
          </button>
          <button [class.active]="selectedPanel() === 'calendar'" (click)="selectPanel('calendar')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 3.5v3"></path>
                <path d="M17 3.5v3"></path>
                <rect x="4" y="5.5" width="16" height="14.5" rx="3"></rect>
                <path d="M4 9.5h16"></path>
                <path d="M8 13h3"></path>
                <path d="M13 13h3"></path>
                <path d="M8 16.5h3"></path>
              </svg>
            </span>
            <span class="side-panel-label">Calendar</span>
          </button>
          <button [class.active]="selectedPanel() === 'badges'" (click)="selectPanel('badges')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="9" r="5"></circle>
                <path d="m9.5 14.5-1 5 3.5-2.2 3.5 2.2-1-5"></path>
                <path d="m10.25 9.25 1.1 1.1 2.4-2.6"></path>
              </svg>
            </span>
            <span class="side-panel-label">Badges & Certificates</span>
          </button>
          <button [class.active]="selectedPanel() === 'performance'" (click)="selectPanel('performance')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 20V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M4 20h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <rect x="7" y="12" width="3" height="8" rx="1"></rect>
                <rect x="12.5" y="8" width="3" height="12" rx="1"></rect>
                <rect x="18" y="4.5" width="3" height="15.5" rx="1"></rect>
              </svg>
            </span>
            <span class="side-panel-label">Performance</span>
          </button>
          <button [class.active]="selectedPanel() === 'idp'" (click)="selectPanel('idp')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M5 6h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M7 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M7 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M9 18h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </span>
            <span class="side-panel-label">My IDP</span>
          </button>
          <button [class.active]="selectedPanel() === 'messages'" (click)="selectPanel('messages')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4.2 3a.5.5 0 0 1-.8-.4V6.5Z"></path>
                <path d="m8 8 4 3 4-3"></path>
              </svg>
            </span>
            <span class="side-panel-label">Messages</span>
          </button>
          <button [class.active]="selectedPanel() === 'profile'" (click)="selectPanel('profile')">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path>
                <path d="M5 19a7 7 0 0 1 14 0"></path>
                <path d="M19.5 8.5h-3"></path>
                <path d="M18 7v3"></path>
              </svg>
            </span>
            <span class="side-panel-label">Profile & Settings</span>
          </button>
          <button class="logout" (click)="logout()">
            <span class="side-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"></path>
                <path d="M14 16l4-4-4-4"></path>
                <path d="M18 12H9"></path>
              </svg>
            </span>
            <span class="side-panel-label">Log out</span>
          </button>
        </nav>

        <main class="main-panel">
          <student-dashboard *ngIf="selectedPanel() === 'dashboard'" (navigateTo)="navigateToPanelFromDashboard($event)"></student-dashboard>
          <student-courses *ngIf="selectedPanel() === 'courses'"></student-courses>

          <section *ngIf="selectedPanel() === 'mentorship'" class="support-section ms-panel">
            <div class="ms-card-grid">

              <!-- Card 1: Profile -->
              <article class="ms-card">
                <div class="ms-card-top">
                  <span class="ms-icon-badge ms-icon-profile">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="#fff" stroke-width="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </span>
                  <div class="ms-card-title-wrap">
                    <h3 class="ms-card-title">Mentorship Profile</h3>
                    <span class="ms-status-badge" [class.ms-status-saved]="mentorshipSectionSaved('profile')" [class.ms-status-draft]="!mentorshipSectionSaved('profile')">{{ mentorshipSectionSaved('profile') ? 'SAVED' : 'DRAFT' }}</span>
                  </div>
                </div>
                <p class="ms-card-desc">Complete your mentorship profile with both mentee and mentor details.</p>

                <div class="ms-progress-row">
                  <span class="ms-progress-label">Profile Completion</span>
                  <span class="ms-progress-pct">{{ mentorshipProfileCompletionPct() }}%</span>
                </div>
                <div class="ms-track"><div class="ms-fill" [style.width.%]="mentorshipProfileCompletionPct()"></div></div>

                <div class="ms-info-row">
                  <span class="ms-info-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#94a3b8" stroke-width="1.8"/><path d="M6 18a6 6 0 0 1 12 0" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>
                    Mentee: {{ (savedMentorshipProfile().menteeName + ' ' + savedMentorshipProfile().menteeSurname).trim() || 'Not set' }}
                  </span>
                  <span class="ms-info-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#94a3b8" stroke-width="1.8"/><path d="M6 18a6 6 0 0 1 12 0" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>
                    Mentor: {{ mentorFullName() || 'Not set' }}
                  </span>
                </div>

                <div class="ms-card-actions">
                  <button type="button" class="ms-btn ms-btn-primary" (click)="selectMentorshipSection('profile')">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
                    {{ mentorshipSectionSaved('profile') ? 'Edit Profile' : 'Start Profile' }}
                  </button>
                  <button type="button" class="ms-btn ms-btn-outline" (click)="selectMentorshipSection('profile')">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path fill="#6366f1" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
                    Preview
                  </button>
                </div>
              </article>

              <!-- Card 2: Objectives -->
              <article class="ms-card">
                <div class="ms-card-top">
                  <span class="ms-icon-badge ms-icon-objectives">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="1" fill="#fff"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </span>
                  <div class="ms-card-title-wrap">
                    <h3 class="ms-card-title">Mentorship Objectives</h3>
                    <span class="ms-status-badge" [class.ms-status-saved]="mentorshipSectionSaved('objectives')" [class.ms-status-draft]="!mentorshipSectionSaved('objectives')">{{ mentorshipSectionSaved('objectives') ? 'SAVED' : 'DRAFT' }}</span>
                  </div>
                </div>
                <p class="ms-card-desc">Use this section for mentorship goals, targets, and planned outcomes.</p>

                <div class="ms-progress-row">
                  <span class="ms-progress-label">Objectives Defined</span>
                  <span class="ms-progress-pct" style="color:#6366f1">{{ mentorshipObjectivesDefinedCount() }} of {{ mentorshipObjectivesTotalCount() }}</span>
                </div>
                <div class="ms-track"><div class="ms-fill" [style.width.%]="mentorshipObjectivesTotalCount() ? (mentorshipObjectivesDefinedCount() / mentorshipObjectivesTotalCount()) * 100 : 0"></div></div>

                <div class="ms-info-row">
                  <span class="ms-info-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#94a3b8" stroke-width="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>
                    Goals: {{ mentorshipGoalsDefinedCount() }}
                  </span>
                  <span class="ms-info-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>
                    Objectives: {{ mentorshipRelObjectivesDefinedCount() }}
                  </span>
                </div>

                <div class="ms-card-actions">
                  <button type="button" class="ms-btn ms-btn-primary" (click)="selectMentorshipSection('objectives')">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
                    New Objective
                  </button>
                  <button type="button" class="ms-btn ms-btn-outline" (click)="selectMentorshipSection('objectives')">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/></svg>
                    View All
                  </button>
                </div>
              </article>

              <!-- Card 3: Form -->
              <article class="ms-card">
                <div class="ms-card-top">
                  <span class="ms-icon-badge ms-icon-form">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" stroke="#fff" stroke-width="1.8"/><path d="M8 7h8M8 11h8M8 15h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </span>
                  <div class="ms-card-title-wrap">
                    <h3 class="ms-card-title">Mentorship Form</h3>
                    <span class="ms-status-badge" [class.ms-status-saved]="mentorshipSectionSaved('form')" [class.ms-status-draft]="!mentorshipSectionSaved('form')">{{ mentorshipSectionSaved('form') ? 'SAVED' : 'DRAFT' }}</span>
                  </div>
                </div>
                <p class="ms-card-desc">Save the mentee and mentor progress report here, then return later to update the saved form.</p>

                <div class="ms-progress-row">
                  <span class="ms-progress-label">Form Completion</span>
                  <span class="ms-progress-pct">{{ mentorshipFormCompletionPct() }}%</span>
                </div>
                <div class="ms-track"><div class="ms-fill" [style.width.%]="mentorshipFormCompletionPct()"></div></div>

                <div class="ms-info-row">
                  <span class="ms-info-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2v10l4 4" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="#94a3b8" stroke-width="1.8"/></svg>
                    Meeting: {{ savedMentorshipProgressReport().dateOfMeeting || 'Not set' }}
                  </span>
                  <span class="ms-info-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Achieved: {{ savedMentorshipProgressReport().objectivesAchieved.length }}
                  </span>
                </div>

                <div class="ms-card-actions">
                  <button type="button" class="ms-btn ms-btn-primary" (click)="selectMentorshipSection('form')">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
                    {{ mentorshipSectionSaved('form') ? 'Edit Form' : 'Continue Form' }}
                  </button>
                  <button type="button" class="ms-btn ms-btn-outline" (click)="selectMentorshipSection('form')">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 3h6l2 3H21a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="#6366f1" stroke-width="1.8" stroke-linecap="round"/></svg>
                    History
                  </button>
                </div>
              </article>

            </div>

            <div *ngIf="mentorshipDialogOpen()" class="mentorship-dialog-backdrop" (click)="closeMentorshipDialog()" aria-hidden="true"></div>

            <section *ngIf="mentorshipDialogOpen()" class="mentorship-dialog mentorship-section-dialog" role="dialog" aria-modal="true">
              <button class="mentorship-section-close" type="button" aria-label="Close mentorship section" (click)="closeMentorshipDialog()">Close</button>

              <div *ngIf="isMentorshipSectionOpen('profile')" class="mentorship-content-inner">
                <div *ngIf="mentorshipSectionSaved('profile') && !mentorshipSectionEditMode(); else mentorshipProfileEditView" class="mentorship-objectives-form">
                  <div class="mentorship-list-header mentorship-objectives-intro">
                    <div>
                      <div class="utility-card-title">Saved Mentorship Profile</div>
                      <p class="utility-card-copy">This section is saved. Review the details below or choose Edit to update the form.</p>
                    </div>
                    <button class="mentorship-list-action" type="button" (click)="openMentorshipSectionEdit()">Edit form</button>
                  </div>

                  <div class="mentorship-profile-header">
                    <span
                      class="mentorship-profile-avatar"
                      [class.mentorship-profile-avatar-has-image]="!!profileImageSrc()"
                      aria-hidden="true">
                      <img *ngIf="profileImageSrc()" [src]="profileImageSrc()!" alt="" />
                      <span *ngIf="!profileImageSrc()">{{ profileInitials() }}</span>
                    </span>

                    <div class="mentorship-profile-header-copy">
                      <div class="mentorship-profile-name">{{ savedMentorshipProfile().menteeName }} {{ savedMentorshipProfile().menteeSurname }}</div>
                      <p class="mentorship-profile-subtitle">Mentor: {{ mentorFullName() || 'Not provided yet' }}</p>
                    </div>
                  </div>

                  <div class="mentorship-form-grid">
                    <div class="mentorship-form-field mentorship-form-field-readonly">
                      <span>Mentee Job Title</span>
                      <strong>{{ savedMentorshipProfile().menteeJobTitle || 'Not provided' }}</strong>
                    </div>
                    <div class="mentorship-form-field mentorship-form-field-readonly">
                      <span>Mentee Qualification</span>
                      <strong>{{ savedMentorshipProfile().menteeQualification || 'Not provided' }}</strong>
                    </div>
                    <div class="mentorship-form-field mentorship-form-field-readonly mentorship-form-field-full">
                      <span>Mentee Experience</span>
                      <strong>{{ savedMentorshipProfile().menteeExperience || 'Not provided' }}</strong>
                    </div>
                    <div class="mentorship-form-field mentorship-form-field-readonly">
                      <span>Mentor Job Title</span>
                      <strong>{{ savedMentorshipProfile().mentorJobTitle || 'Not provided' }}</strong>
                    </div>
                    <div class="mentorship-form-field mentorship-form-field-readonly">
                      <span>Mentor Qualification</span>
                      <strong>{{ savedMentorshipProfile().mentorQualification || 'Not provided' }}</strong>
                    </div>
                    <div class="mentorship-form-field mentorship-form-field-readonly mentorship-form-field-full">
                      <span>Mentor Experience</span>
                      <strong>{{ savedMentorshipProfile().mentorExperience || 'Not provided' }}</strong>
                    </div>
                  </div>
                </div>

                <ng-template #mentorshipProfileEditView>
                <form class="mentorship-profile-form mentorship-profile-program-form" [formGroup]="mentorshipProfileForm" (ngSubmit)="saveMentorshipProfile()">
                  <header class="mentorship-profile-program-hero">
                    <div class="mentorship-profile-program-hero-top">
                      <span
                        class="mentorship-profile-avatar mentorship-profile-program-avatar"
                        [class.mentorship-profile-avatar-has-image]="!!profileImageSrc()"
                        aria-hidden="true">
                        <img *ngIf="profileImageSrc()" [src]="profileImageSrc()!" alt="" />
                        <span *ngIf="!profileImageSrc()">{{ profileInitials() }}</span>
                        <span class="mentorship-profile-program-avatar-badge" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M8 16h2.2l6.1-6.1a1.6 1.6 0 0 0 0-2.3l-.9-.9a1.6 1.6 0 0 0-2.3 0L7 12.8V15a1 1 0 0 0 1 1Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12.5 7.3 16.7 11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </span>
                      </span>

                      <div class="mentorship-profile-header-copy mentorship-profile-program-copy">
                        <div class="mentorship-profile-name mentorship-profile-program-name">{{ mentorshipProfileForm.controls.menteeName.value }} {{ mentorshipProfileForm.controls.menteeSurname.value }}</div>
                        <p class="mentorship-profile-subtitle mentorship-profile-program-subtitle">Mentorship Profile</p>
                      </div>
                    </div>
                    <span class="mentorship-profile-program-notch" aria-hidden="true"></span>
                  </header>

                  <section class="mentorship-profile-program-panel mentorship-profile-program-panel-mentee">
                    <div class="mentorship-profile-program-panel-header">
                      <div class="mentorship-profile-program-panel-title-shell">
                        <span class="mentorship-profile-program-panel-icon mentorship-profile-program-panel-icon-mentee" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.8"/>
                            <path d="M6 18a6 6 0 0 1 12 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                          </svg>
                        </span>
                        <div>
                          <div class="mentorship-profile-program-panel-title">Mentee Details</div>
                          <p class="mentorship-profile-program-panel-copy">Personal and professional information</p>
                        </div>
                      </div>
                    </div>

                    <div class="mentorship-form-grid mentorship-profile-program-grid">
                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Name</span>
                        <input type="text" formControlName="menteeName" placeholder="Enter mentee name" />
                      </label>

                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Surname</span>
                        <input type="text" formControlName="menteeSurname" placeholder="Enter mentee surname" />
                      </label>

                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Job Title</span>
                        <input type="text" formControlName="menteeJobTitle" placeholder="Enter job title" readonly />
                      </label>

                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Qualification</span>
                        <input type="text" formControlName="menteeQualification" placeholder="Enter qualification" />
                      </label>

                      <label class="mentorship-form-field mentorship-form-field-full mentorship-profile-program-field">
                        <span>Experience</span>
                        <textarea rows="3" formControlName="menteeExperience" placeholder="Describe your experience"></textarea>
                      </label>
                    </div>
                  </section>

                  <section class="mentorship-profile-program-panel mentorship-profile-program-panel-mentor">
                    <div class="mentorship-profile-program-panel-header">
                      <div class="mentorship-profile-program-panel-title-shell">
                        <span class="mentorship-profile-program-panel-icon mentorship-profile-program-panel-icon-mentor" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M7 9.5A2.5 2.5 0 1 0 7 4.5a2.5 2.5 0 0 0 0 5ZM17 11.5A2.5 2.5 0 1 0 17 6.5a2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="1.7"/>
                            <path d="M3.5 17a4.5 4.5 0 0 1 7 0M11.5 19a5 5 0 0 1 9 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                          </svg>
                        </span>
                        <div>
                          <div class="mentorship-profile-program-panel-title">Mentor Details</div>
                          <p class="mentorship-profile-program-panel-copy">Assigned mentor information</p>
                        </div>
                      </div>
                    </div>

                    <div class="mentorship-form-grid mentorship-profile-program-grid">
                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Mentor Name</span>
                        <input type="text" formControlName="mentorName" placeholder="Enter mentor name" />
                      </label>

                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Mentor Surname</span>
                        <input type="text" formControlName="mentorSurname" placeholder="Enter mentor surname" />
                      </label>

                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Job Title</span>
                        <input type="text" formControlName="mentorJobTitle" placeholder="Enter job title" />
                      </label>

                      <label class="mentorship-form-field mentorship-profile-program-field">
                        <span>Qualification</span>
                        <input type="text" formControlName="mentorQualification" placeholder="Enter qualification" />
                      </label>

                      <label class="mentorship-form-field mentorship-form-field-full mentorship-profile-program-field">
                        <span>Experience</span>
                        <textarea rows="3" formControlName="mentorExperience" placeholder="Describe mentor experience"></textarea>
                      </label>
                    </div>
                  </section>

                  <div class="mentorship-form-actions mentorship-profile-program-actions">
                    <p *ngIf="mentorshipProfileSaved()" class="mentorship-form-status" role="status" aria-live="polite">
                      Mentorship profile saved.
                    </p>

                    <button *ngIf="mentorshipSectionSaved('profile')" class="mentorship-list-action" type="button" (click)="cancelMentorshipSectionEdit()">Cancel</button>
                    <button class="mentorship-save-button" type="submit">Save</button>
                  </div>
                </form>
                </ng-template>
              </div>

              <div *ngIf="isMentorshipSectionOpen('objectives')" class="mentorship-content-inner">
                <div *ngIf="mentorshipSectionSaved('objectives') && !mentorshipSectionEditMode(); else mentorshipObjectivesEditView" class="mentorship-objectives-form">
                  <div class="mentorship-list-header mentorship-objectives-intro">
                    <div>
                      <div class="utility-card-title">Saved Mentorship Objectives</div>
                      <p class="utility-card-copy">These objectives are saved. Review them below or choose Edit to update the form.</p>
                    </div>
                    <button class="mentorship-list-action" type="button" (click)="openMentorshipSectionEdit()">Edit form</button>
                  </div>

                  <div class="mentorship-list-group">
                    <div class="mentorship-list-header">
                      <span>Mentorship Goals</span>
                    </div>

                    <div class="mentorship-list-items">
                      <div *ngFor="let goal of savedMentorshipObjectives().mentorshipGoals; let index = index" class="mentorship-list-item">
                        <span class="mentorship-row-number" aria-hidden="true">{{ index + 1 }}</span>
                        <div class="mentorship-profile-header-copy">
                          <strong>{{ goal.title || 'No goal title' }}</strong>
                          <span>Date set: {{ goal.date || 'Not provided' }} • Achievement date: {{ goal.achievementDate || 'Not provided' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mentorship-list-group">
                    <div class="mentorship-list-header">
                      <span>Objectives</span>
                    </div>

                    <div class="mentorship-list-items">
                      <div *ngFor="let objective of savedMentorshipObjectives().objectives; let index = index" class="mentorship-list-item">
                        <span class="mentorship-row-number" aria-hidden="true">{{ index + 1 }}</span>
                        <div class="mentorship-profile-header-copy">
                          <strong>{{ objective.title || 'No objective title' }}</strong>
                          <span>Date set: {{ objective.date || 'Not provided' }} • Achievement date: {{ objective.achievementDate || 'Not provided' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <ng-template #mentorshipObjectivesEditView>
                <form class="mentorship-objectives-form mentorship-program-form" [formGroup]="mentorshipObjectivesForm" (ngSubmit)="saveMentorshipObjectives()">
                  <header class="mentorship-program-hero">
                    <h3>Mentorship Program</h3>
                    <p>Define your goals and track your progress</p>
                  </header>

                  <div class="mentorship-list-group mentorship-program-card">
                    <div class="mentorship-list-header mentorship-program-card-header">
                      <div class="mentorship-program-card-title-shell">
                        <span class="mentorship-program-card-title">Mentorship Goals</span>
                        <span class="mentorship-program-count" aria-hidden="true">{{ mentorshipGoalsControls().length }}</span>
                      </div>
                      <button class="mentorship-list-action mentorship-program-add" type="button" (click)="addMentorshipGoal()">+ Add Goal</button>
                    </div>

                    <div class="mentorship-list-items mentorship-program-card-body" formArrayName="mentorshipGoals">
                      @for (goalControl of mentorshipGoalsControls(); track $index) {
                        <div class="mentorship-list-item mentorship-program-entry" [formGroupName]="$index">
                          <div class="mentorship-program-entry-top">
                            <div class="mentorship-program-entry-heading">
                              <span class="mentorship-row-number" aria-hidden="true">{{ $index + 1 }}</span>
                              <span class="mentorship-program-entry-label">Goal {{ $index + 1 }}</span>
                            </div>

                            <button
                              class="mentorship-list-remove mentorship-program-remove"
                              type="button"
                              [disabled]="mentorshipGoalsControls().length === 1"
                              (click)="removeMentorshipGoal($index)">
                              Remove
                            </button>
                          </div>

                          <label class="mentorship-form-field mentorship-form-field-compact mentorship-program-field">
                            <span>Description</span>
                            <input type="text" formControlName="title" placeholder="Add a mentorship goal." />
                          </label>

                          <div class="mentorship-program-date-grid">
                            <label class="mentorship-form-field mentorship-form-field-compact mentorship-objective-date mentorship-program-field">
                              <span>Date Set</span>
                              <input type="date" formControlName="date" />
                            </label>

                            <label class="mentorship-form-field mentorship-form-field-compact mentorship-objective-date mentorship-program-field">
                              <span>Achievement Date</span>
                              <input type="date" formControlName="achievementDate" />
                            </label>
                          </div>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="mentorship-list-group mentorship-program-card">
                    <div class="mentorship-list-header mentorship-program-card-header">
                      <div class="mentorship-program-card-title-shell">
                        <span class="mentorship-program-card-title">Objectives</span>
                        <span class="mentorship-program-count" aria-hidden="true">{{ relationshipObjectivesControls().length }}</span>
                      </div>
                      <button class="mentorship-list-action mentorship-program-add" type="button" (click)="addRelationshipObjective()">+ Add Objective</button>
                    </div>

                    <div class="mentorship-list-items mentorship-program-card-body" formArrayName="objectives">
                      @for (objectiveControl of relationshipObjectivesControls(); track $index) {
                        <div class="mentorship-list-item mentorship-program-entry" [formGroupName]="$index">
                          <div class="mentorship-program-entry-top">
                            <div class="mentorship-program-entry-heading">
                              <span class="mentorship-row-number" aria-hidden="true">{{ $index + 1 }}</span>
                              <span class="mentorship-program-entry-label">Objective {{ $index + 1 }}</span>
                            </div>

                            <button
                              class="mentorship-list-remove mentorship-program-remove"
                              type="button"
                              [disabled]="relationshipObjectivesControls().length === 1"
                              (click)="removeRelationshipObjective($index)">
                              Remove
                            </button>
                          </div>

                          <label class="mentorship-form-field mentorship-form-field-compact mentorship-program-field">
                            <span>Description</span>
                            <input type="text" formControlName="title" placeholder="Add an objective." />
                          </label>

                          <div class="mentorship-program-date-grid">
                            <label class="mentorship-form-field mentorship-form-field-compact mentorship-objective-date mentorship-program-field">
                              <span>Date Set</span>
                              <input type="date" formControlName="date" />
                            </label>

                            <label class="mentorship-form-field mentorship-form-field-compact mentorship-objective-date mentorship-program-field">
                              <span>Achievement Date</span>
                              <input type="date" formControlName="achievementDate" />
                            </label>
                          </div>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="mentorship-form-actions mentorship-program-actions">
                    <p *ngIf="mentorshipObjectivesSaved()" class="mentorship-form-status" role="status" aria-live="polite">
                      Mentorship objectives saved.
                    </p>

                    <button *ngIf="mentorshipSectionSaved('objectives')" class="mentorship-list-action" type="button" (click)="cancelMentorshipSectionEdit()">Cancel</button>
                    <button class="mentorship-save-button" type="submit">Save</button>
                  </div>
                </form>
                </ng-template>
              </div>

              <div *ngIf="isMentorshipSectionOpen('form')" class="mentorship-content-inner">
                <div *ngIf="mentorshipSectionSaved('form') && !mentorshipSectionEditMode(); else mentorshipProgressEditView" class="mentorship-objectives-form">
                  <div class="mentorship-list-header mentorship-objectives-intro">
                    <div>
                      <div class="utility-card-title">Saved Mentorship Form</div>
                      <p class="utility-card-copy">This progress form is saved. Review it below or choose Edit to make changes.</p>
                    </div>
                    <button class="mentorship-list-action" type="button" (click)="openMentorshipSectionEdit()">Edit form</button>
                  </div>

                  <div class="mentorship-form-grid">
                    <div class="mentorship-form-field mentorship-form-field-readonly">
                      <span>Date of Meeting</span>
                      <strong>{{ savedMentorshipProgressReport().dateOfMeeting || 'Not provided' }}</strong>
                    </div>
                    <div class="mentorship-form-field mentorship-form-field-readonly mentorship-form-field-full">
                      <span>Mentor Comments</span>
                      <strong>{{ savedMentorshipProgressReport().mentorComments || 'Not provided' }}</strong>
                    </div>
                  </div>

                  <div class="mentorship-list-group">
                    <div class="mentorship-list-header">
                      <span>Mentee Objectives Achieved</span>
                    </div>

                    <div class="mentorship-list-items">
                      <div *ngFor="let entry of savedMentorshipProgressReport().objectivesAchieved; let index = index" class="mentorship-list-item">
                        <span class="mentorship-row-number" aria-hidden="true">{{ index + 1 }}</span>
                        <div class="mentorship-profile-header-copy">
                          <strong>{{ entry.objectiveAchieved || 'No objective recorded' }}</strong>
                          <span>Date achieved: {{ entry.dateAchieved || 'Not provided' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <ng-template #mentorshipProgressEditView>
                <form class="mentorship-form-report mentorship-progress-program-form" [formGroup]="mentorshipProgressReportForm" (ngSubmit)="saveMentorshipProgressReport()">
                  <header class="mentorship-progress-hero">
                    <h3>Mentee and Mentor Progress Report</h3>
                    <p>Track meeting outcomes and achievements</p>
                  </header>

                  <section class="mentorship-progress-panel mentorship-progress-panel-meeting">
                    <label class="mentorship-form-field mentorship-progress-field mentorship-progress-meeting-field">
                      <span>Date of Meeting</span>
                      <input type="date" formControlName="dateOfMeeting" />
                    </label>
                  </section>

                  <section class="mentorship-list-group mentorship-progress-panel mentorship-progress-panel-achieved">
                    <div class="mentorship-list-header mentorship-progress-panel-header">
                      <div class="mentorship-progress-title-shell">
                        <span class="mentorship-progress-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M7 12.5 10 15.5 17 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </span>
                        <span class="mentorship-progress-title">Mentee Objectives Achieved</span>
                      </div>
                      <button class="mentorship-list-action mentorship-progress-add" type="button" (click)="addProgressEntry()">+ Add Row</button>
                    </div>

                    <div class="mentorship-progress-rows mentorship-progress-list" formArrayName="objectivesAchieved">
                      @for (entryControl of progressEntryControls(); track $index) {
                        <div class="mentorship-progress-row mentorship-progress-entry" [formGroupName]="$index">
                          <div class="mentorship-progress-entry-top">
                            <div class="mentorship-progress-entry-heading">
                              <span class="mentorship-row-number" aria-hidden="true">{{ $index + 1 }}</span>
                              <span class="mentorship-progress-state">Achieved</span>
                            </div>

                            <button
                              class="mentorship-list-remove mentorship-progress-remove"
                              type="button"
                              [disabled]="progressEntryControls().length === 1"
                              (click)="removeProgressEntry($index)">
                              Remove
                            </button>
                          </div>

                          <label class="mentorship-form-field mentorship-form-field-compact mentorship-progress-field mentorship-progress-description-field">
                            <span>Objective Description</span>
                            <input type="text" formControlName="objectiveAchieved" placeholder="Add an achieved objective." />
                          </label>

                          <label class="mentorship-form-field mentorship-form-field-compact mentorship-progress-field mentorship-progress-date mentorship-progress-date-field">
                            <span>Date</span>
                            <input type="date" formControlName="dateAchieved" />
                          </label>
                        </div>
                      }
                    </div>
                  </section>

                  <section class="mentorship-progress-panel mentorship-progress-comments-panel">
                    <div class="mentorship-progress-title-shell mentorship-progress-comments-title-shell">
                      <span class="mentorship-progress-icon mentorship-progress-icon-comments" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M8 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <path d="M8 7h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                      </span>
                      <span class="mentorship-progress-title">Mentor Comments</span>
                    </div>

                    <label class="mentorship-form-field mentorship-form-field-full mentorship-progress-field mentorship-progress-comments-field">
                      <span class="mentorship-progress-visually-hidden">Mentor Comments</span>
                      <textarea rows="5" formControlName="mentorComments" placeholder="Add mentor comments."></textarea>
                    </label>
                  </section>

                  <div class="mentorship-form-actions mentorship-progress-actions">
                    <p *ngIf="mentorshipProgressReportSaved()" class="mentorship-form-status" role="status" aria-live="polite">
                      Progress report saved.
                    </p>

                    <button *ngIf="mentorshipSectionSaved('form')" class="mentorship-list-action" type="button" (click)="cancelMentorshipSectionEdit()">Cancel</button>
                    <button class="mentorship-save-button" type="submit">Save</button>
                  </div>
                </form>
                </ng-template>
              </div>
            </section>
          </section>

          <section *ngIf="selectedPanel() === 'calendar'" class="calendar-section">
            <student-calendar></student-calendar>
          </section>

          <student-badges *ngIf="selectedPanel() === 'badges'"></student-badges>

          <section *ngIf="selectedPanel() === 'performance'" class="performance-section">
            <div class="section-heading-block">
              <p class="eyebrow">Performance</p>
              <h1>Performance</h1>
            </div>

            <button type="button" class="kpi-overlay-backdrop" aria-label="Exit full screen" *ngIf="kpiFullScreen()" (click)="kpiFullScreen.set(false)"></button>

            <div class="kpi-year-selector-row" *ngIf="managerData.kpiYearsOpened().length > 1">
              <span class="kpi-year-selector-label">KPI year</span>
              <select class="kpi-year-selector" [value]="selectedKpiYear()" (change)="selectKpiYear(+$any($event.target).value)">
                <option *ngFor="let year of managerData.kpiYearsOpened()" [value]="year">{{ year }}{{ year === managerData.currentKpiYear() ? ' (current)' : '' }}</option>
              </select>
              <span class="kpi-year-readonly-badge" *ngIf="!isViewingCurrentKpiYear()">Read-only — past year</span>
            </div>

            <div class="idp-program-card" [class.kpi-overlay-active]="kpiFullScreen()" *ngIf="myKpiEntries().length > 0; else noKpiEntries">
              <div class="idp-program-card-header">
                <div class="idp-program-card-title-shell">
                  <span class="idp-program-card-title">My KPIs</span>
                  <span class="idp-program-count" aria-hidden="true">{{ myKpiEntries().length }} {{ myKpiEntries().length === 1 ? 'KPI' : 'KPIs' }}</span>
                  <span class="kpi-total-weight" [class.kpi-total-weight-off]="myKpiTotalWeight() !== 100">
                    Total weight: {{ myKpiTotalWeight() }}%
                  </span>
                </div>
                <button
                  type="button"
                  class="kpi-fullscreen-toggle"
                  [class.kpi-fullscreen-toggle-active]="kpiFullScreen()"
                  [attr.aria-pressed]="kpiFullScreen()"
                  (click)="kpiFullScreen.set(!kpiFullScreen())">
                  <svg *ngIf="!kpiFullScreen()" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <svg *ngIf="kpiFullScreen()" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ kpiFullScreen() ? 'Exit full screen' : 'Full screen' }}</span>
                </button>
              </div>

              <div class="kpi-table-wrap">
                <table class="kpi-table">
                  <colgroup>
                    <col style="width: 15%" />
                    <col style="width: 7%" />
                    <col style="width: 13%" />
                    <col style="width: 12%" />
                    <col style="width: 12%" />
                    <col style="width: 11%" />
                    <col style="width: 11%" />
                    <col style="width: 11%" />
                    <col style="width: 8%" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>KPI</th>
                      <th class="kpi-cell-weight">Weight</th>
                      <th>Agreed Output</th>
                      <th>Measure</th>
                      <th>Comments</th>
                      <th class="kpi-cell-center">Manager Scoring</th>
                      <th class="kpi-cell-center">Employee Scoring</th>
                      <th class="kpi-cell-center">Overall Scoring</th>
                      <th class="kpi-cell-center">Date of Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let entry of myKpiEntries(); trackBy: trackKpiEntryById">
                      <td>{{ entry.kpi || 'Not provided' }}</td>
                      <td class="kpi-cell-weight">{{ entry.weight }}%</td>
                      <td>{{ entry.agreedOutput || 'Not provided' }}</td>
                      <td>{{ entry.measure || 'Not provided' }}</td>
                      <td>{{ entry.comments || 'Not provided' }}</td>
                      <td class="kpi-cell-center"><span class="kpi-score-pill" [class.kpi-score-flag]="entry.managerScoring === 2" [class.kpi-score-empty]="entry.managerScoring === null">{{ kpiScoreLabel(entry.managerScoring) }}</span></td>
                      <td class="kpi-cell-center kpi-employee-scoring-cell" [class.kpi-score-flag]="resolveEmployeeScoringDisplay(entry) === 2" *ngIf="isViewingCurrentKpiYear(); else employeeScoringReadOnly">
                        <select [value]="resolveEmployeeScoringDisplay(entry) ?? ''" (change)="stageMyKpiEmployeeScoring(entry.id, $event)">
                          <option value="">Not scored</option>
                          <option *ngFor="let option of kpiScoreOptions" [value]="option.value">{{ option.label }}</option>
                        </select>
                        <span class="kpi-employee-scoring-pending" *ngIf="isEmployeeScoringPending(entry.id)">Not submitted yet</span>
                      </td>
                      <ng-template #employeeScoringReadOnly>
                        <td class="kpi-cell-center"><span class="kpi-score-pill" [class.kpi-score-flag]="entry.employeeScoring === 2" [class.kpi-score-empty]="entry.employeeScoring === null">{{ kpiScoreLabel(entry.employeeScoring) }}</span></td>
                      </ng-template>
                      <td class="kpi-cell-center"><span class="kpi-score-pill" [class.kpi-score-flag]="entry.overallScoring === 2" [class.kpi-score-empty]="entry.overallScoring === null">{{ kpiScoreLabel(entry.overallScoring) }}</span></td>
                      <td class="kpi-cell-center">{{ entry.dateOfReview || 'Not provided' }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="kpi-totals-row">
                      <td>Totals</td>
                      <td class="kpi-cell-weight" [class.kpi-total-weight-off]="myKpiTotalWeight() !== 100">{{ myKpiTotalWeight() }}%</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td class="kpi-cell-center"></td>
                      <td class="kpi-cell-center"></td>
                      <td class="kpi-cell-center"><span class="kpi-score-pill kpi-total-rating-pill">{{ formatKpiOverallRating(myKpiOverallWeightedRating()) }}</span></td>
                      <td class="kpi-cell-center"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div class="kpi-submit-actions" *ngIf="isViewingCurrentKpiYear()">
                @if (kpiSubmitSaved()) {
                  <p class="kpi-submit-status kpi-submit-status-saved" role="status" aria-live="polite">Ratings submitted.</p>
                }
                @if (kpiSubmitError()) {
                  <p class="kpi-submit-status kpi-submit-status-error" role="alert">Couldn't save — try again.</p>
                }
                <button
                  type="button"
                  class="kpi-submit-button"
                  [disabled]="!hasPendingKpiChanges() || kpiSubmitting()"
                  (click)="submitMyKpiRatings()">
                  {{ kpiSubmitting() ? 'Submitting…' : 'Submit Ratings' }}
                </button>
              </div>
              <p class="kpi-year-empty-note" *ngIf="!isViewingCurrentKpiYear()">This is a closed, read-only record of {{ selectedKpiYear() }} — only the current year can be scored.</p>
            </div>
            <ng-template #noKpiEntries>
              <article class="utility-card">
                <p *ngIf="isViewingCurrentKpiYear()">Your manager hasn't set up any KPIs for you yet.</p>
                <p *ngIf="!isViewingCurrentKpiYear()">No KPIs were recorded for {{ selectedKpiYear() }}.</p>
              </article>
            </ng-template>
          </section>

          <student-messages *ngIf="selectedPanel() === 'messages'" [initialSection]="messagesInitialSection()"></student-messages>

          <section *ngIf="selectedPanel() === 'external-training'" class="et-section">
            <div class="et-stats-row">
              <div class="et-stat-card">
                <div class="et-stat-icon et-stat-icon-blue">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2L15 22l-4-9-9-4 20-7Z" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="et-stat-value">{{ learnerExternalTrainingRequests().length }}</div>
                <div class="et-stat-label">Total Requests</div>
              </div>
              <div class="et-stat-card">
                <div class="et-stat-icon et-stat-icon-amber">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#f59e0b" stroke-width="2"/><path d="M12 7v5l3 3" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>
                </div>
                <div class="et-stat-value">{{ etPendingCount() }}</div>
                <div class="et-stat-label">Pending Approval</div>
              </div>
              <div class="et-stat-card">
                <div class="et-stat-icon et-stat-icon-green">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#22c55e" stroke-width="2"/><path d="M8 12l3 3 5-5" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="et-stat-value">{{ etApprovedCount() }}</div>
                <div class="et-stat-label">Approved</div>
              </div>
            </div>

            <div class="et-action-grid">
              <button type="button" class="et-action-card" (click)="openExternalTrainingRequestDialog()">
                <div class="et-action-tag">New Request</div>
                <div class="et-action-icon et-action-icon-purple">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
                </div>
                <h3 class="et-action-title">Request Training</h3>
                <p class="et-action-desc">Start a new training request for review and approval. Fill out the training details, cost estimates, and justification for your learning path.</p>
                <div class="et-action-footer">
                  <span class="et-action-time">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#94a3b8" stroke-width="2"/><path d="M12 7v5l3 3" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>
                    ~5 min to complete
                  </span>
                  <span class="et-action-link">Get Started →</span>
                </div>
              </button>

              <button type="button" class="et-action-card et-action-card-teal" (click)="openExternalTrainingStatusDialog()">
                <div class="et-action-tag et-action-tag-teal">Track Progress</div>
                <div class="et-action-icon et-action-icon-teal">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <h3 class="et-action-title">Training Status</h3>
                <p class="et-action-desc">Track the current status of your submitted training requests. View approval stages, feedback, and estimated completion timelines.</p>
                <div class="et-action-footer">
                  <span class="et-action-time">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><circle cx="3.5" cy="6" r="1" fill="#94a3b8"/><circle cx="3.5" cy="12" r="1" fill="#94a3b8"/><circle cx="3.5" cy="18" r="1" fill="#94a3b8"/></svg>
                    {{ learnerExternalTrainingRequests().length }} active request{{ learnerExternalTrainingRequests().length !== 1 ? 's' : '' }}
                  </span>
                  <span class="et-action-link et-action-link-teal">View Status →</span>
                </div>
              </button>
            </div>

            <div class="et-activity">
              <div class="et-activity-header">
                <h2 class="et-activity-title">Recent Activity</h2>
                <button type="button" class="et-activity-view-all" (click)="openExternalTrainingStatusDialog()">View All</button>
              </div>
              <div *ngIf="!learnerExternalTrainingRequests().length" class="et-empty">No training requests submitted yet.</div>
              <div class="et-activity-list">
                <div *ngFor="let req of etRecentRequests()" class="et-activity-item">
                  <div class="et-activity-avatar">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" fill="#818cf8"/><path d="M7 10h10M7 14h6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>
                  </div>
                  <div class="et-activity-info">
                    <div class="et-activity-name">{{ req.courseName }}</div>
                    <div class="et-activity-meta">Submitted {{ etRelativeTime(req.submittedAt) }}<span *ngIf="req.courseCost"> &bull; R{{ req.courseCost }}</span></div>
                  </div>
                  <span class="et-status-badge" [class.et-status-approved]="req.status === 'Approved'" [class.et-status-revision]="req.status === 'Needs Revision'" [class.et-status-pending]="req.status === 'Pending Review'">{{ req.status }}</span>
                </div>
              </div>
            </div>
          </section>

          <div *ngIf="externalTrainingRequestDialogOpen()" class="mentorship-dialog-backdrop" (click)="closeExternalTrainingRequestDialog()" aria-hidden="true"></div>

          <section *ngIf="externalTrainingRequestDialogOpen()" class="mentorship-dialog external-training-request-dialog" role="dialog" aria-modal="true" aria-labelledby="external-training-request-title">
            <button class="mentorship-dialog-close external-training-request-close" type="button" aria-label="Close training request form" (click)="closeExternalTrainingRequestDialog()">Close</button>

            <div class="mentorship-content-box external-training-request-card">
              <header class="external-training-request-hero">
                <div class="external-training-request-hero-copy">
                  <h3 id="external-training-request-title">{{ externalTrainingRequestDialogTitle() }}</h3>
                  <p>{{ externalTrainingRequestDialogDescription() }} <span class="external-training-required" aria-hidden="true">*</span></p>
                </div>
              </header>

              <form class="mentorship-objectives-form external-training-request-form" [formGroup]="externalTrainingRequestForm" (ngSubmit)="submitExternalTrainingRequest()">
                <div class="mentorship-form-grid external-training-request-grid">
                  <label class="mentorship-form-field external-training-request-field">
                    <span>Course Name <span class="external-training-required" aria-hidden="true">*</span></span>
                    <input type="text" formControlName="courseName" placeholder="Enter the course name" />
                  </label>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Provider <span class="external-training-required" aria-hidden="true">*</span></span>
                    <input type="text" formControlName="provider" placeholder="Enter training provider name" />
                  </label>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Type of Training <span class="external-training-required" aria-hidden="true">*</span></span>
                    <select formControlName="trainingType">
                      <option value="Accredited">Accredited</option>
                      <option value="Workshop/Seminar">Workshop/Seminar</option>
                      <option value="Informal Training">Informal Training</option>
                      <option value="Short Course">Short Course</option>
                    </select>
                  </label>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Is the Training aligned with your IDP <span class="external-training-required" aria-hidden="true">*</span></span>
                    <select formControlName="alignedToIdp">
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </label>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Training Start Date <span class="external-training-required" aria-hidden="true">*</span></span>
                    <input type="date" formControlName="trainingStartDate" />
                  </label>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Training End Date <span class="external-training-required" aria-hidden="true">*</span></span>
                    <input type="date" formControlName="trainingEndDate" />
                  </label>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Course Cost <span class="external-training-required" aria-hidden="true">*</span></span>
                    <input type="text" formControlName="courseCost" placeholder="Enter course cost" />
                  </label>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Additional Cost Required <span class="external-training-required" aria-hidden="true">*</span></span>
                    <select formControlName="additionalCostRequired" (change)="onAdditionalCostRequiredChange()">
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </label>

                  <ng-container *ngIf="externalTrainingRequestForm.controls.additionalCostRequired.value === 'Yes'">
                    <label class="mentorship-form-field external-training-request-field">
                      <span>Travel Cost <span class="external-training-required" aria-hidden="true">*</span></span>
                      <input type="text" formControlName="travelCost" placeholder="Enter travel cost" />
                    </label>

                    <label class="mentorship-form-field external-training-request-field">
                      <span>Exam Cost <span class="external-training-required" aria-hidden="true">*</span></span>
                      <input type="text" formControlName="examCost" placeholder="Enter exam cost" />
                    </label>

                    <label class="mentorship-form-field external-training-request-field">
                      <span>Accommodation Cost <span class="external-training-required" aria-hidden="true">*</span></span>
                      <input type="text" formControlName="accommodationCost" placeholder="Enter accommodation cost" />
                    </label>
                  </ng-container>

                  <label class="mentorship-form-field external-training-request-field">
                    <span>Training Manager to Approve <span class="external-training-required" aria-hidden="true">*</span></span>
                    <select formControlName="approvingManagerId">
                      <option value="" disabled>Select a training manager</option>
                      <option *ngFor="let manager of availableTrainingManagers()" [value]="manager.id">
                        {{ manager.name }} - {{ manager.team }}
                      </option>
                    </select>
                    <span *ngIf="!availableTrainingManagers().length" class="utility-card-copy external-training-request-support-copy">No training managers are available right now.</span>
                  </label>

                  <label class="mentorship-form-field mentorship-form-field-full external-training-request-field external-training-request-upload-field">
                    <span>Attach Invoice</span>
                    <input type="file" class="external-training-request-file-input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" [disabled]="externalTrainingInvoiceUploading()" (change)="onExternalTrainingInvoiceSelected($event)" />
                    <span *ngIf="externalTrainingInvoiceUploading()" class="utility-card-copy external-training-request-support-copy">Uploading…</span>
                    <span *ngIf="!externalTrainingInvoiceUploading() && externalTrainingInvoiceFileName()" class="utility-card-copy external-training-request-support-copy">Selected: {{ externalTrainingInvoiceFileName() }}</span>
                  </label>

                  <label class="mentorship-form-field mentorship-form-field-full external-training-request-field external-training-request-upload-field">
                    <span>Attach Brochure</span>
                    <input type="file" class="external-training-request-file-input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" [disabled]="externalTrainingBrochureUploading()" (change)="onExternalTrainingBrochureSelected($event)" />
                    <span *ngIf="externalTrainingBrochureUploading()" class="utility-card-copy external-training-request-support-copy">Uploading…</span>
                    <span *ngIf="!externalTrainingBrochureUploading() && externalTrainingBrochureFileName()" class="utility-card-copy external-training-request-support-copy">Selected: {{ externalTrainingBrochureFileName() }}</span>
                  </label>
                </div>

                <div class="mentorship-form-actions external-training-request-actions">
                  <p *ngIf="externalTrainingRequestSubmitted()" class="mentorship-form-status external-training-request-status" role="status" aria-live="polite">Training request submitted successfully.</p>
                  <button type="submit" class="mentorship-save-button external-training-request-submit" [disabled]="externalTrainingRequestForm.invalid || externalTrainingInvoiceUploading() || externalTrainingBrochureUploading()">{{ externalTrainingRequestSubmitLabel() }}</button>
                </div>
              </form>
            </div>
          </section>

          <div *ngIf="externalTrainingStatusDialogOpen()" class="mentorship-dialog-backdrop" (click)="closeExternalTrainingStatusDialog()" aria-hidden="true"></div>

          <section *ngIf="externalTrainingStatusDialogOpen()" class="mentorship-dialog external-training-status-dialog" role="dialog" aria-modal="true" aria-labelledby="external-training-status-title">
            <button class="mentorship-dialog-close external-training-request-close external-training-status-close" type="button" aria-label="Close external training status" (click)="closeExternalTrainingStatusDialog()">Close</button>

            <div class="mentorship-content-box external-training-status-card">
              <div class="section-heading-row">
                <div>
                  <p class="form-section-eyebrow">Training Request</p>
                  <h3 id="external-training-status-title">Training Status</h3>
                  <p class="section-copy">Review your submitted requests and the latest feedback from the assigned training manager.</p>
                </div>
              </div>

              @if (learnerExternalTrainingRequests().length) {
                <div class="external-training-status-shell">
                  <div class="external-training-status-list" role="list" aria-label="Submitted training requests">
                    @for (request of learnerExternalTrainingRequests(); track request.id) {
                      <button
                        type="button"
                        class="external-training-status-list-item"
                        [class.external-training-status-list-item-active]="selectedLearnerExternalTrainingRequestId() === request.id"
                        (click)="openExternalTrainingRequestDetail(request.id)">
                        <div class="external-training-status-list-copy">
                          <strong>{{ request.courseName }}</strong>
                          <span>{{ request.provider }} with {{ request.approvingManagerName }}</span>
                        </div>

                        <div class="external-training-status-list-meta">
                          <span class="external-training-status-list-date">Submitted {{ request.submittedAt }}</span>
                          <span class="mentorship-item-status" [class.mentorship-item-status-saved]="request.status === 'Approved'">{{ request.status }}</span>
                          <span class="external-training-status-list-link">View request</span>
                        </div>
                      </button>
                    }
                  </div>

                  @if (selectedLearnerExternalTrainingRequest(); as activeRequest) {
                    <div class="external-training-status-detail-overlay" (click)="closeExternalTrainingRequestDetail()">
                      <article
                        class="external-training-status-detail-box"
                        role="document"
                        aria-label="Submitted training request details"
                        (click)="$event.stopPropagation()">
                        <div class="external-training-status-detail-header">
                          <div>
                            <p class="form-section-eyebrow">Submitted request</p>
                            <h4>{{ activeRequest.courseName }}</h4>
                            <p>{{ activeRequest.provider }} with {{ activeRequest.approvingManagerName }}</p>
                          </div>

                          <div class="external-training-status-detail-header-actions">
                            <span class="mentorship-item-status" [class.mentorship-item-status-saved]="activeRequest.status === 'Approved'">{{ activeRequest.status }}</span>
                            @if (activeRequest.status === 'Needs Revision') {
                              <button type="button" class="external-training-status-detail-action" (click)="editExternalTrainingRequest(activeRequest)">Edit and resubmit</button>
                            }
                            <button type="button" class="external-training-status-detail-close" (click)="closeExternalTrainingRequestDetail()">Close</button>
                          </div>
                        </div>

                        <div class="mentorship-form-grid external-training-status-detail-grid">
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Submitted</span>
                            <strong>{{ activeRequest.submittedAt }}</strong>
                          </div>
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Reviewed</span>
                            <strong>{{ activeRequest.reviewedAt || 'Awaiting manager review' }}</strong>
                          </div>
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Training dates</span>
                            <strong>{{ activeRequest.trainingStartDate }} to {{ activeRequest.trainingEndDate }}</strong>
                          </div>
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Type of training</span>
                            <strong>{{ activeRequest.trainingType }}</strong>
                          </div>
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Aligned with IDP</span>
                            <strong>{{ activeRequest.alignedToIdp }}</strong>
                          </div>
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Course cost</span>
                            <strong>{{ activeRequest.courseCost }}</strong>
                          </div>
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Additional costs required</span>
                            <strong>{{ activeRequest.additionalCostRequired }}</strong>
                          </div>
                          <div class="mentorship-form-field mentorship-form-field-readonly">
                            <span>Assigned manager</span>
                            <strong>{{ activeRequest.approvingManagerName }}</strong>
                          </div>

                          @if (activeRequest.additionalCostRequired === 'Yes') {
                            <div class="mentorship-form-field mentorship-form-field-readonly mentorship-form-field-full">
                              <span>Additional cost breakdown</span>
                              <strong>Travel: {{ activeRequest.travelCost }} | Exam: {{ activeRequest.examCost }} | Accommodation: {{ activeRequest.accommodationCost }}</strong>
                            </div>
                          }

                          <div class="mentorship-form-field mentorship-form-field-readonly mentorship-form-field-full">
                            <span>Manager feedback</span>
                            <strong>{{ activeRequest.reviewerFeedback || 'No feedback added yet.' }}</strong>
                          </div>
                        </div>

                        @if (activeRequest.invoiceFileName || activeRequest.brochureFileName) {
                          <div class="external-training-status-detail-documents">
                            <strong>Supporting documents</strong>
                            <div class="external-training-status-detail-actions">
                              @if (activeRequest.invoiceFileName) {
                                <button type="button" class="external-training-status-detail-action" (click)="openExternalTrainingSupportingDocument(activeRequest.invoiceDataUrl)">
                                  Open invoice
                                </button>
                              }

                              @if (activeRequest.brochureFileName) {
                                <button type="button" class="external-training-status-detail-action" (click)="openExternalTrainingSupportingDocument(activeRequest.brochureDataUrl)">
                                  Open brochure
                                </button>
                              }
                            </div>
                          </div>
                        }
                      </article>
                    </div>
                  }
                </div>
              } @else {
                <article class="utility-card">
                  <div class="utility-card-title">No submitted requests yet</div>
                  <p class="utility-card-copy">Once you submit a training request, its review status will appear here.</p>
                </article>
              }
            </div>
          </section>

          <section *ngIf="selectedPanel() === 'idp'" class="idp-section">
            <div class="section-heading-block">
              <p class="eyebrow">Individual Development Plan</p>
              <h1>My IDP</h1>
            </div>

            <div class="idp-program-card" *ngIf="managerIdpEntries().length > 0; else noIdpEntries">
              <div class="idp-program-card-header">
                <div class="idp-program-card-title-shell">
                  <span class="idp-program-card-title">Saved IDP Entries</span>
                  <span class="idp-program-count" aria-hidden="true">{{ managerIdpEntries().length }} {{ managerIdpEntries().length === 1 ? 'entry' : 'entries' }}</span>
                </div>
              </div>
              <div class="idp-program-card-body">
                <ng-container *ngFor="let entry of managerIdpEntries(); let i = index">
                  <div class="idp-program-entry">
                    <div class="idp-program-entry-top">
                      <div class="idp-program-entry-heading">
                        <span class="idp-row-number" aria-hidden="true">{{ i + 1 }}</span>
                        <span class="idp-program-entry-label">Entry {{ i + 1 }}</span>
                      </div>
                      <span class="idp-status-badge"
                        [class.idp-status-in-progress]="entry.status === 'In Progress'"
                        [class.idp-status-completed]="entry.status === 'Completed'"
                        [class.idp-status-on-hold]="entry.status === 'On Hold'">
                        {{ entry.status }}
                      </span>
                    </div>
                    <div class="idp-readonly-grid">
                      <div class="idp-readonly-field idp-readonly-field-full">
                        <span>Development Need</span>
                        <strong>{{ entry.developmentNeed || 'Not provided' }}</strong>
                      </div>
                      <div class="idp-readonly-field idp-readonly-field-full">
                        <span>Planned Action</span>
                        <strong>{{ entry.plannedAction || 'Not provided' }}</strong>
                      </div>
                      <div class="idp-readonly-field">
                        <span>Support Required</span>
                        <strong>{{ entry.supportRequired || 'Not provided' }}</strong>
                      </div>
                      <div class="idp-readonly-field">
                        <span>Date Captured</span>
                        <strong>{{ entry.dateCaptured || 'Not provided' }}</strong>
                      </div>
                      <div class="idp-readonly-field">
                        <span>Target Date</span>
                        <strong>{{ entry.targetDate || 'Not provided' }}</strong>
                      </div>
                    </div>
                  </div>
                </ng-container>
              </div>
            </div>
            <ng-template #noIdpEntries>
              <article class="utility-card">
                <div class="utility-card-title">No IDP entries from your manager yet</div>
                <p class="utility-card-copy">Once your manager fills out your Individual Development Plan, it will appear here as a summary.</p>
              </article>
            </ng-template>
          </section>

          <student-profile-settings *ngIf="selectedPanel() === 'profile'"></student-profile-settings>
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --ui-scale: 0.86;
      --sidebar-stack-offset: calc((4.1rem + 72px) * var(--ui-scale) + 4px);
      display: block;
      min-height: 100vh;
      background: #eef2f7;
      font-family: 'Inter', 'Segoe UI', 'Roboto', Arial, sans-serif;
    }

    .profile-shell {
      position: relative;
      isolation: isolate;
      min-height: 100vh;
      padding: calc(1rem * var(--ui-scale));
      box-sizing: border-box;
      background:
        radial-gradient(circle at top left, var(--brand-tint), transparent 20%),
        linear-gradient(180deg, #f6f8fc 0%, var(--brand-surface) 100%);
    }

    .welcome-banner {
      position: fixed;
      top: calc(1rem * var(--ui-scale));
      left: 50%;
      z-index: 150;
      width: min(calc(360px * var(--ui-scale)), calc(100vw - 2rem));
      padding: calc(0.95rem * var(--ui-scale)) calc(1.2rem * var(--ui-scale));
      border: 1px solid rgba(129, 140, 248, 0.18);
      border-radius: calc(20px * var(--ui-scale));
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      box-shadow: 0 20px 40px rgba(79, 70, 229, 0.24);
      color: #fff;
      transform: translate(-50%, -120%);
      opacity: 0;
      animation: welcome-banner-drop 0.6s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
      backdrop-filter: blur(12px);
      pointer-events: none;
    }

    .welcome-banner-leaving {
      animation: welcome-banner-exit 0.45s ease forwards;
    }

    .welcome-banner-title {
      font-size: calc(1rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .welcome-banner-copy {
      margin-top: calc(0.2rem * var(--ui-scale));
      font-size: calc(0.86rem * var(--ui-scale));
      color: rgba(255, 255, 255, 0.88);
    }

    .submit-success-popup {
      position: fixed;
      top: calc(1.25rem * var(--ui-scale));
      right: calc(1.25rem * var(--ui-scale));
      z-index: 130;
      display: grid;
      gap: calc(0.28rem * var(--ui-scale));
      max-width: min(24rem, calc(100vw - 2rem));
      padding: calc(0.95rem * var(--ui-scale)) calc(1.1rem * var(--ui-scale));
      border-radius: calc(18px * var(--ui-scale));
      background: linear-gradient(135deg, #14532d, #16a34a);
      box-shadow: 0 18px 40px rgba(21, 128, 61, 0.28);
      color: #f8fafc;
      opacity: 0;
      transform: translateY(-30%);
      animation: submit-success-popup-enter 0.45s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
      pointer-events: none;
    }

    .submit-success-popup-leaving {
      animation: submit-success-popup-exit 0.35s ease forwards;
    }

    .submit-success-popup-title {
      font-size: calc(0.96rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .submit-success-popup-copy {
      font-size: calc(0.84rem * var(--ui-scale));
      line-height: 1.4;
      color: rgba(248, 250, 252, 0.92);
    }

    @keyframes submit-success-popup-enter {
      0% {
        transform: translateY(-30%);
        opacity: 0;
      }

      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes submit-success-popup-exit {
      0% {
        transform: translateY(0);
        opacity: 1;
      }

      100% {
        transform: translateY(-20%);
        opacity: 0;
      }
    }

    @keyframes welcome-banner-drop {
      0% {
        transform: translate(-50%, -120%);
        opacity: 0;
      }

      100% {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }

    @keyframes welcome-banner-exit {
      0% {
        transform: translate(-50%, 0);
        opacity: 1;
      }

      100% {
        transform: translate(-50%, -60%);
        opacity: 0;
      }
    }

    .profile-topbar {
      position: sticky;
      top: calc(1rem * var(--ui-scale));
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(1rem * var(--ui-scale));
      min-height: calc(72px * var(--ui-scale));
      margin-bottom: calc(1rem * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale)) calc(1.2rem * var(--ui-scale));
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), var(--brand-surface));
      border: 1px solid var(--brand-tint);
      border-bottom: 3px solid var(--brand-primary);
      border-radius: calc(14px * var(--ui-scale));
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 4px 14px rgba(15, 23, 42, 0.045);
      box-sizing: border-box;
    }

    .profile-shell-dialog-open .profile-topbar,
    .profile-shell-dialog-open .welcome-banner {
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }

    .topbar-brand {
      display: flex;
      align-items: center;
      gap: calc(0.9rem * var(--ui-scale));
    }

    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.6rem * var(--ui-scale));
      height: calc(2.6rem * var(--ui-scale));
      border-radius: calc(16px * var(--ui-scale));
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      font-size: calc(1.1rem * var(--ui-scale));
      font-weight: 800;
      overflow: hidden;
    }

    .brand-mark-has-image {
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.22);
    }

    .brand-mark img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .brand-name {
      color: var(--brand-primary);
      font-size: calc(1.15rem * var(--ui-scale));
      font-weight: 800;
      line-height: 1.1;
    }

    .brand-copy {
      color: #64748b;
      font-size: calc(0.9rem * var(--ui-scale));
      margin-top: calc(0.15rem * var(--ui-scale));
    }

    .topbar-icons {
      display: flex;
      align-items: center;
      gap: calc(0.8rem * var(--ui-scale));
    }

    .topbar-dropdown-wrap {
      position: relative;
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      width: calc(2.8rem * var(--ui-scale));
      height: calc(2.8rem * var(--ui-scale));
      border: 1px solid var(--brand-tint);
      border-radius: calc(16px * var(--ui-scale));
      background: var(--brand-surface);
      cursor: pointer;
      transition: box-shadow 0.15s ease, background 0.15s ease;
    }

    .icon-btn:hover,
    .icon-btn:focus-visible {
      background: var(--brand-tint);
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
      outline: none;
    }

    .icon-btn-active {
      border-color: var(--brand-secondary);
      background: var(--brand-tint);
    }

    .icon-counter {
      position: absolute;
      top: calc(-0.2rem * var(--ui-scale));
      right: calc(-0.2rem * var(--ui-scale));
      min-width: calc(1.15rem * var(--ui-scale));
      height: calc(1.15rem * var(--ui-scale));
      padding: 0 calc(0.25rem * var(--ui-scale));
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: calc(0.72rem * var(--ui-scale));
      font-weight: 800;
      line-height: calc(1.15rem * var(--ui-scale));
      text-align: center;
      box-shadow: 0 6px 12px rgba(239, 68, 68, 0.25);
    }

    .topbar-dropdown-item {
      display: grid;
    }

    .topbar-dropdown-item > * {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Notification items */
    .notif-item {
      display: flex;
      align-items: flex-start;
      border-bottom: 1px solid var(--ui-border, #e2e8f0);
      background: transparent;
    }

    .notif-item:last-child {
      border-bottom: none;
    }

    .notif-item-unread {
      background: color-mix(in srgb, var(--brand-primary, #6366f1) 5%, transparent);
    }

    .notif-item-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: calc(0.65rem * var(--ui-scale)) calc(0.9rem * var(--ui-scale));
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;
      color: inherit;
      width: 0; /* allow text-overflow inside flex */
      min-width: 0;
    }

    .notif-item-body:hover {
      background: rgba(0,0,0,0.04);
    }

    .notif-badge-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    }

    .notif-badge {
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--brand-primary, #6366f1);
      background: color-mix(in srgb, var(--brand-primary, #6366f1) 12%, transparent);
      border-radius: 4px;
      padding: 1px 6px;
      white-space: nowrap;
    }

    .notif-date {
      font-size: 0.72rem;
      color: #94a3b8;
      white-space: nowrap;
    }

    .notif-unread-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--brand-primary, #6366f1);
      flex-shrink: 0;
      margin-left: auto;
    }

    .notif-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .notif-body-text {
      font-size: 0.78rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .notif-dismiss-btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: calc(2rem * var(--ui-scale));
      height: calc(2rem * var(--ui-scale));
      margin: calc(0.5rem * var(--ui-scale)) calc(0.4rem * var(--ui-scale)) 0 0;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: #94a3b8;
      cursor: pointer;
      opacity: 0.6;
    }

    .notif-dismiss-btn:hover {
      background: rgba(0,0,0,0.06);
      opacity: 1;
      color: #ef4444;
    }

    .profile-menu-wrap {
      position: relative;
      z-index: 30;
    }

    .profile-menu-trigger {
      display: inline-flex;
      align-items: center;
      gap: calc(0.7rem * var(--ui-scale));
      min-height: calc(2.8rem * var(--ui-scale));
      padding: calc(0.25rem * var(--ui-scale)) calc(0.4rem * var(--ui-scale)) calc(0.25rem * var(--ui-scale)) calc(0.25rem * var(--ui-scale));
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: #475569;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .profile-menu-trigger:hover,
    .profile-menu-trigger:focus-visible,
    .profile-menu-trigger-active {
      background: var(--brand-surface);
      border-color: var(--brand-tint);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      outline: none;
    }

    .profile-menu-name {
      max-width: calc(11rem * var(--ui-scale));
      color: #475569;
      font-size: calc(0.98rem * var(--ui-scale));
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .topbar-profile-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.25rem * var(--ui-scale));
      height: calc(2.25rem * var(--ui-scale));
      border-radius: 999px;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      font-size: calc(0.88rem * var(--ui-scale));
      font-weight: 800;
      overflow: hidden;
    }

    .topbar-profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .topbar-profile-avatar-has-image {
      background: #fff;
    }

    .profile-menu-backdrop {
      position: fixed;
      inset: 0;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      z-index: 19;
      cursor: default;
    }

    .profile-menu-panel {
      position: absolute;
      top: calc(100% + calc(0.75rem * var(--ui-scale)));
      right: 0;
      width: min(17rem, calc(100vw - 2rem));
      padding: calc(0.4rem * var(--ui-scale)) 0;
      border-radius: calc(18px * var(--ui-scale));
      background: var(--brand-surface);
      border: 1px solid var(--brand-tint);
      box-shadow: 0 22px 48px rgba(15, 23, 42, 0.18);
      overflow: hidden;
      z-index: 31;
    }

    .profile-menu-header {
      display: grid;
      gap: calc(0.2rem * var(--ui-scale));
      padding: calc(0.7rem * var(--ui-scale)) calc(0.85rem * var(--ui-scale)) calc(0.8rem * var(--ui-scale));
    }

    .profile-menu-header-name {
      color: var(--brand-primary);
      font-size: calc(0.94rem * var(--ui-scale));
      font-weight: 700;
    }

    .profile-menu-header-email {
      color: #64748b;
      font-size: calc(0.82rem * var(--ui-scale));
    }

    .profile-menu-group {
      display: grid;
      gap: calc(0.15rem * var(--ui-scale));
      padding: calc(0.2rem * var(--ui-scale)) calc(0.38rem * var(--ui-scale));
    }

    .profile-menu-group-bordered {
      border-top: 1px solid var(--brand-tint);
      margin-top: 0.25rem;
      padding-top: 0.55rem;
    }

    .profile-menu-section-label {
      padding: calc(0.3rem * var(--ui-scale)) calc(0.62rem * var(--ui-scale)) calc(0.15rem * var(--ui-scale));
      font-size: calc(0.7rem * var(--ui-scale));
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .profile-menu-item {
      display: flex;
      align-items: center;
      gap: calc(0.8rem * var(--ui-scale));
      width: 100%;
      padding: calc(0.58rem * var(--ui-scale)) calc(0.62rem * var(--ui-scale));
      border: none;
      border-radius: calc(12px * var(--ui-scale));
      background: transparent;
      color: #475569;
      font-size: calc(0.9rem * var(--ui-scale));
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .profile-menu-item:hover,
    .profile-menu-item:focus-visible {
      background: var(--brand-tint);
      color: var(--brand-primary);
      outline: none;
    }

    .profile-menu-item:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .profile-menu-item-danger {
      color: #ef4444;
    }

    .profile-menu-item-danger:hover,
    .profile-menu-item-danger:focus-visible {
      background: #fef2f2;
      color: #dc2626;
    }

    .profile-menu-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: currentColor;
      flex: 0 0 auto;
    }

    .profile-layout {
      display: grid;
      grid-template-columns: calc(260px * var(--ui-scale)) minmax(0, 1fr);
      gap: calc(1rem * var(--ui-scale));
      min-height: calc(100vh - 6.5rem);
    }

    .profile-layout.profile-layout-side-panel-collapsed {
      grid-template-columns: calc(92px * var(--ui-scale)) minmax(0, 1fr);
    }

    .side-panel {
      display: flex;
      flex-direction: column;
      gap: calc(0.65rem * var(--ui-scale));
      align-self: start;
      position: sticky;
      top: var(--sidebar-stack-offset);
      height: calc(100vh - var(--sidebar-stack-offset) - calc(1rem * var(--ui-scale)));
      overflow: auto;
      padding: calc(0.85rem * var(--ui-scale));
      background: #ffffff;
      border: 1px solid var(--brand-tint);
      border-left: 4px solid var(--brand-primary);
      border-radius: calc(14px * var(--ui-scale));
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 4px 14px rgba(15, 23, 42, 0.045);
      scrollbar-width: none;
      scrollbar-color: transparent transparent;
    }

    .side-panel.side-panel-scrolling {
      scrollbar-width: thin;
      scrollbar-color: rgba(15, 23, 42, 0.28) transparent;
    }

    .side-panel::-webkit-scrollbar {
      width: 6px;
    }

    .side-panel::-webkit-scrollbar-track {
      background: transparent;
    }

    .side-panel::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 999px;
      transition: background-color 0.3s ease;
    }

    .side-panel.side-panel-scrolling::-webkit-scrollbar-thumb {
      background-color: rgba(15, 23, 42, 0.28);
    }

    .side-panel-header {
      display: flex;
      justify-content: flex-end;
    }

    .side-panel-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.5rem * var(--ui-scale));
      height: calc(2.5rem * var(--ui-scale));
      border: 1px solid var(--brand-tint);
      border-radius: calc(14px * var(--ui-scale));
      background: var(--brand-surface);
      color: var(--brand-primary);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, color 0.15s ease;
    }

    .side-panel-toggle:hover,
    .side-panel-toggle:focus-visible {
      background: var(--brand-tint);
      border-color: var(--brand-primary);
      outline: none;
      transform: translateY(-1px);
    }

    .side-panel-toggle svg {
      width: calc(1.1rem * var(--ui-scale));
      height: calc(1.1rem * var(--ui-scale));
      stroke: currentColor;
    }

    .side-panel-title {
      color: var(--brand-primary);
      font-size: 1rem;
      font-weight: 700;
    }

    .side-panel-copy {
      color: #64748b;
      font-size: 0.92rem;
      margin-top: 0.2rem;
    }

    .side-panel button {
      display: flex;
      align-items: center;
      gap: calc(0.85rem * var(--ui-scale));
      width: 100%;
      border: 1px solid transparent;
      border-radius: calc(14px * var(--ui-scale));
      background: transparent;
      padding: calc(0.85rem * var(--ui-scale)) calc(1rem * var(--ui-scale));
      color: #334155;
      text-align: left;
      font-size: calc(0.98rem * var(--ui-scale));
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
    }

    .side-panel button:hover,
    .side-panel button:focus-visible {
      background: var(--brand-tint);
      border-color: var(--brand-tint);
      transform: translateX(2px);
      outline: none;
    }

    .side-panel button.active {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
    }

    .side-panel-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 calc(2.35rem * var(--ui-scale));
      width: calc(2.35rem * var(--ui-scale));
      height: calc(2.35rem * var(--ui-scale));
      border-radius: calc(14px * var(--ui-scale));
      border: 1px solid var(--brand-tint);
      background: var(--brand-surface);
      color: #475569;
      transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .side-panel-icon svg {
      width: calc(1.15rem * var(--ui-scale));
      height: calc(1.15rem * var(--ui-scale));
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .side-panel-label {
      min-width: 0;
      flex: 1 1 auto;
    }

    .side-panel-collapsed {
      gap: calc(0.55rem * var(--ui-scale));
      padding-inline: calc(0.7rem * var(--ui-scale));
    }

    .side-panel-collapsed .side-panel-header {
      justify-content: center;
    }

    .side-panel-collapsed .side-panel-toggle {
      width: calc(2.5rem * var(--ui-scale));
    }

    .side-panel-collapsed button {
      justify-content: center;
      padding-inline: calc(0.7rem * var(--ui-scale));
    }

    .side-panel-collapsed .side-panel-label {
      display: none;
    }

    .side-panel-collapsed .side-panel-icon {
      flex-basis: calc(2.6rem * var(--ui-scale));
      width: calc(2.6rem * var(--ui-scale));
    }

    .side-panel button.logout {
      margin-top: auto;
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .side-panel button.logout:hover,
    .side-panel button.logout:focus-visible {
      background: #fecaca;
    }

    .side-panel button:hover .side-panel-icon,
    .side-panel button:focus-visible .side-panel-icon {
      transform: translateY(-1px) scale(1.02);
      border-color: var(--brand-primary);
      color: var(--brand-primary);
    }

    .side-panel button.active .side-panel-icon {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.22);
      color: #fff;
    }

    .side-panel button.logout .side-panel-icon {
      background: rgba(255, 255, 255, 0.5);
      border-color: rgba(185, 28, 28, 0.12);
      color: #b91c1c;
    }

    .main-panel {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      min-height: 100%;
    }

    .calendar-section,
    .support-section {
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
    }

    .support-section {
      display: flex;
      flex-direction: column;
      gap: calc(1rem * var(--ui-scale));
      padding: calc(1.6rem * var(--ui-scale));
      background: rgba(255, 255, 255, 0.94);
      border-radius: calc(24px * var(--ui-scale));
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    }

    .support-section h2 {
      margin: 0;
      color: #14213d;
      font-size: calc(1.5rem * var(--ui-scale));
      font-weight: 700;
    }

    /* ─── Mentorship card redesign ─── */
    .ms-panel {
      background: #f8faff !important;
    }

    .ms-card-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.1rem;
    }

    .ms-card {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      padding: 1.35rem 1.4rem;
      background: #fff;
      border: 1px solid #e8edf5;
      border-radius: 20px;
      box-shadow: 0 2px 12px rgba(15,23,42,0.06);
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease;
      cursor: default;
    }

    .ms-card:hover {
      transform: translateY(-6px) scale(1.012);
      box-shadow: 0 16px 36px rgba(99,102,241,0.16), 0 4px 14px rgba(15,23,42,0.08);
    }

    .ms-card:hover .ms-icon-badge {
      transform: scale(1.18) rotate(-4deg);
      box-shadow: 0 6px 20px rgba(99,102,241,0.45);
    }

    .ms-card-top {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }

    .ms-icon-badge {
      flex-shrink: 0;
      width: 2.8rem;
      height: 2.8rem;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s ease;
    }

    .ms-icon-profile  { background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 14px rgba(99,102,241,0.28); }
    .ms-icon-objectives { background: linear-gradient(135deg, #06b6d4, #0891b2); box-shadow: 0 4px 14px rgba(6,182,212,0.28); }
    .ms-icon-form     { background: linear-gradient(135deg, #8b5cf6, #7c3aed); box-shadow: 0 4px 14px rgba(139,92,246,0.28); }

    .ms-card-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      min-width: 0;
    }

    .ms-card-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }

    .ms-status-badge {
      display: inline-block;
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      width: fit-content;
    }

    .ms-status-saved { background: #dbeafe; color: #1d4ed8; }
    .ms-status-draft  { background: #fef9c3; color: #854d0e; }

    .ms-card-desc {
      margin: 0;
      font-size: 0.88rem;
      color: #64748b;
      line-height: 1.5;
      flex: 1;
    }

    .ms-progress-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ms-progress-label { font-size: 0.85rem; color: #475569; font-weight: 500; }
    .ms-progress-pct { font-size: 0.85rem; color: #6366f1; font-weight: 700; }

    .ms-track {
      width: 100%;
      height: 0.45rem;
      border-radius: 999px;
      background: #e2e8f0;
      overflow: hidden;
    }

    .ms-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #6366f1, #818cf8);
      transition: width 0.4s ease;
    }

    .ms-info-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem 1.1rem;
    }

    .ms-info-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      color: #64748b;
    }

    .ms-card-actions {
      display: flex;
      gap: 0.6rem;
      margin-top: auto;
      padding-top: 0.5rem;
      border-top: 1px solid #f1f5f9;
    }

    .ms-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.55rem 0.95rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: opacity 0.15s ease, box-shadow 0.15s ease;
      font-family: inherit;
      white-space: nowrap;
    }

    .ms-btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      box-shadow: 0 4px 12px rgba(99,102,241,0.25);
    }

    .ms-btn-primary:hover { opacity: 0.88; }

    .ms-btn-outline {
      background: transparent;
      color: #6366f1;
      border: 1.5px solid #c7d2fe;
    }

    .ms-btn-outline:hover { background: #ede9fe; }

    @media (max-width: 900px) {
      .ms-card-grid { grid-template-columns: 1fr; }
    }
    /* ─── end Mentorship ─── */

    /* ─── IDP Read-only Card (mirrors manager saved style) ─── */
    .idp-section {
      display: grid;
      gap: 1rem;
    }

    .idp-program-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 1.25rem;
      overflow: hidden;
    }

    .idp-program-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .idp-program-card-title-shell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .idp-program-card-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
    }

    .idp-program-count {
      font-size: 0.72rem;
      font-weight: 800;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .idp-program-card-body {
      padding: 0.75rem 1.25rem;
    }

    .idp-program-entry {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .idp-program-entry:last-child {
      margin-bottom: 0;
    }

    .idp-program-entry-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      gap: 0.75rem;
    }

    .idp-program-entry-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .idp-row-number {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .idp-program-entry-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #334155;
    }

    .idp-status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      background: #f1f5f9;
      color: #475569;
      white-space: nowrap;
    }

    .idp-status-badge.idp-status-in-progress {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .idp-status-badge.idp-status-completed {
      background: #f0fdf4;
      color: #15803d;
    }

    .idp-status-badge.idp-status-on-hold {
      background: #fff7ed;
      color: #c2410c;
    }

    .idp-readonly-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
      margin-top: 0.5rem;
    }

    .idp-readonly-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.6rem 0.75rem;
      background: #fff;
      border: 1px solid #f1f5f9;
      border-radius: 7px;
    }

    .idp-readonly-field span {
      font-size: 0.72rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .idp-readonly-field strong {
      font-size: 0.875rem;
      color: #0f172a;
      font-weight: 500;
      line-height: 1.4;
    }

    /* ── KPI Table ─────────────────────────────────────────────────── */
    /* .main-panel is a column flexbox — without min-width: 0 here, a flex item won't shrink
       below its content's natural width, so the wide KPI table (min-width: 60rem) was forcing
       this whole section past its intended bounds instead of scrolling internally inside
       .kpi-table-wrap where it belongs. */
    .performance-section {
      min-width: 0;
    }
    .idp-program-card {
      min-width: 0;
    }
    .kpi-table-wrap {
      overflow-x: auto;
      min-width: 0;
      padding: 0 1.25rem 1.25rem;
    }

    .kpi-table {
      width: 100%;
      min-width: 46rem;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.83rem;
    }

    .kpi-table th,
    .kpi-table td {
      padding: 0.75rem 0.85rem;
      text-align: left;
      vertical-align: middle;
      border-bottom: 1px solid #eef1f6;
      overflow-wrap: break-word;
    }

    .kpi-table thead th {
      padding-top: 0.7rem;
      padding-bottom: 0.7rem;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #64748b;
      white-space: normal;
      overflow-wrap: break-word;
      background: linear-gradient(180deg, #f8fafc 0%, #f3f6fb 100%);
      border-bottom: 1px solid #e7ecf3;
    }

    .kpi-table td {
      color: #1e293b;
      line-height: 1.45;
    }

    .kpi-table tbody tr:last-of-type td {
      border-bottom: none;
    }

    .kpi-table tbody tr:nth-child(even) td {
      background: #fbfcfe;
    }

    .kpi-table tbody tr:hover td {
      background: var(--brand-tint);
    }

    .kpi-cell-weight {
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .kpi-cell-center {
      text-align: center;
    }

    .kpi-score-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.3rem;
      max-width: 100%;
      padding: 0.28rem 0.6rem;
      border-radius: 14px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1.3;
      white-space: normal;
      overflow-wrap: break-word;
    }

    .kpi-score-pill.kpi-score-empty {
      background: #f1f5f9;
      color: #94a3b8;
      font-weight: 600;
    }

    .kpi-score-pill.kpi-score-flag {
      background: #fef2f2;
      color: #b91c1c;
    }

    .kpi-employee-scoring-cell select {
      display: block;
      width: 100%;
      max-width: 100%;
      padding: 0.5rem 0.6rem;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font: inherit;
      color: #0f172a;
      background: #fff;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .kpi-employee-scoring-cell select:hover {
      border-color: #cbd5e1;
    }

    .kpi-employee-scoring-cell select:focus {
      border-color: var(--brand-primary);
      outline: none;
      box-shadow: 0 0 0 3px var(--brand-tint);
    }

    .kpi-employee-scoring-pending {
      display: block;
      font-size: 0.72rem;
      font-weight: 700;
      color: #b45309;
    }

    .kpi-submit-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.8rem;
      padding: 0.9rem 1rem 0;
      flex-wrap: wrap;
    }

    .kpi-submit-status {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .kpi-submit-status-saved {
      color: #15803d;
    }

    .kpi-submit-status-error {
      color: #b91c1c;
    }

    .kpi-submit-button {
      padding: 0.6rem 1.3rem;
      border: none;
      border-radius: 999px;
      background: var(--brand-primary);
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.15s ease, opacity 0.15s ease;
    }

    .kpi-submit-button:hover:not(:disabled) {
      background: var(--brand-secondary);
    }

    .kpi-submit-button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .kpi-total-weight {
      font-size: 0.76rem;
      font-weight: 700;
      color: #15803d;
      white-space: nowrap;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #f0fdf4;
    }

    .kpi-total-weight-off {
      color: #b91c1c;
      background: #fef2f2;
    }

    .kpi-year-selector-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.85rem;
    }

    .kpi-year-selector-label {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }

    .kpi-year-selector {
      padding: 0.4rem 0.7rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font: inherit;
      color: #0f172a;
      background: #fff;
    }

    .kpi-year-readonly-badge {
      font-size: 0.76rem;
      font-weight: 700;
      color: #b45309;
      background: #fffbeb;
      border-radius: 999px;
      padding: 0.2rem 0.65rem;
    }

    .kpi-year-empty-note {
      margin: 0.75rem 0 0;
      font-size: 0.85rem;
      color: #64748b;
    }

    .kpi-employee-scoring-cell.kpi-score-flag select {
      border-color: #ef4444;
      background: #fef2f2;
      color: #b91c1c;
      font-weight: 700;
    }

    .kpi-totals-row td {
      font-weight: 800;
      color: #0f172a;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border-top: 2px solid #e2e8f0;
      border-bottom: none;
    }

    .kpi-total-rating-pill {
      background: #eef2ff;
      color: #4338ca;
      font-size: 0.78rem;
    }

    /* "Full screen" toggles the same card into a large centered overlay instead of duplicating
       the table markup — a backdrop button appears alongside it to let the student click out. */
    .kpi-overlay-backdrop {
      position: fixed;
      inset: 0;
      z-index: 79;
      border: none;
      cursor: pointer;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(3px);
    }

    .idp-program-card.kpi-overlay-active {
      position: fixed;
      inset: 0;
      z-index: 80;
      margin: auto;
      width: min(1500px, 96vw);
      height: min(1000px, 92vh);
      max-height: 92vh;
      overflow: auto;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      animation: kpi-overlay-panel-enter 0.22s ease-out;
    }

    @keyframes kpi-overlay-panel-enter {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .kpi-fullscreen-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.9rem;
      border: 1px solid var(--brand-tint);
      border-radius: 999px;
      background: #fff;
      color: var(--brand-primary);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .kpi-fullscreen-toggle svg {
      flex-shrink: 0;
    }

    .kpi-fullscreen-toggle:hover {
      background: var(--brand-tint);
      border-color: var(--brand-primary);
    }

    .kpi-fullscreen-toggle:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--brand-tint);
    }

    .kpi-fullscreen-toggle-active {
      background: var(--brand-primary);
      border-color: var(--brand-primary);
      color: #fff;
    }

    .kpi-fullscreen-toggle-active:hover {
      background: var(--brand-secondary);
      border-color: var(--brand-secondary);
    }

    .idp-readonly-field-full {
      grid-column: 1 / -1;
    }

    /* ─── External Training redesign ─── */
    .et-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: calc(1.6rem * var(--ui-scale));
      background: #f8faff;
      border-radius: calc(24px * var(--ui-scale));
      min-height: 100%;
      box-sizing: border-box;
    }

    .et-header { display: flex; flex-direction: column; gap: 0.35rem; }
    .et-title { margin: 0; font-size: 1.8rem; font-weight: 800; color: #0f172a; }
    .et-subtitle { margin: 0; color: #64748b; font-size: 0.97rem; max-width: 48rem; line-height: 1.55; }

    .et-stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }

    .et-stat-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.2rem 1.35rem;
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e8edf5;
      box-shadow: 0 2px 8px rgba(15,23,42,0.05);
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease;
    }

    .et-stat-card:hover {
      transform: translateY(-6px) scale(1.012);
      box-shadow: 0 16px 36px rgba(99,102,241,0.16), 0 4px 14px rgba(15,23,42,0.08);
    }

    .et-stat-icon {
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .et-stat-icon-blue  { background: #eff6ff; }
    .et-stat-icon-amber { background: #fffbeb; }
    .et-stat-icon-green { background: #f0fdf4; }

    .et-stat-value { font-size: 2rem; font-weight: 800; color: #0f172a; line-height: 1; }
    .et-stat-label { font-size: 0.88rem; color: #64748b; font-weight: 500; }

    .et-action-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .et-action-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.4rem 1.5rem 1.25rem;
      background: #fff;
      border: 1px solid #e8edf5;
      border-radius: 20px;
      box-shadow: 0 4px 16px rgba(15,23,42,0.06);
      text-align: left;
      cursor: pointer;
      font: inherit;
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease;
    }

    .et-action-card:hover {
      transform: translateY(-6px) scale(1.012);
      box-shadow: 0 16px 36px rgba(99,102,241,0.16), 0 4px 14px rgba(15,23,42,0.08);
    }

    .et-action-tag {
      position: absolute;
      top: 1.1rem;
      right: 1.1rem;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      background: #ede9fe;
      color: #7c3aed;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .et-action-tag-teal {
      background: #d1fae5;
      color: #065f46;
    }

    .et-action-icon {
      width: 3rem;
      height: 3rem;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s ease;
    }

    .et-action-card:hover .et-action-icon {
      transform: scale(1.18) rotate(-4deg);
    }

    .et-action-icon-purple { background: linear-gradient(135deg, #7c3aed, #6366f1); }
    .et-action-icon-teal   { background: linear-gradient(135deg, #0d9488, #059669); }

    .et-action-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #0f172a; }
    .et-action-desc  { margin: 0; font-size: 0.92rem; color: #64748b; line-height: 1.55; flex: 1; }

    .et-action-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.25rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f1f5f9;
    }

    .et-action-time { display: flex; align-items: center; gap: 0.35rem; color: #94a3b8; font-size: 0.85rem; }

    .et-action-link { color: #6366f1; font-size: 0.9rem; font-weight: 700; }
    .et-action-link-teal { color: #0d9488; }

    .et-activity {
      background: #fff;
      border: 1px solid #e8edf5;
      border-radius: 20px;
      padding: 1.35rem 1.5rem;
      box-shadow: 0 2px 8px rgba(15,23,42,0.05);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .et-activity-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .et-activity-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a; }

    .et-activity-view-all {
      border: none;
      background: transparent;
      color: #6366f1;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }

    .et-empty { color: #94a3b8; font-size: 0.9rem; text-align: center; padding: 1rem 0; }

    .et-activity-list { display: flex; flex-direction: column; gap: 0; }

    .et-activity-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.85rem 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .et-activity-item:last-child { border-bottom: none; }

    .et-activity-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 10px;
      background: #ede9fe;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .et-activity-info { flex: 1; min-width: 0; }
    .et-activity-name { font-size: 0.96rem; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .et-activity-meta { font-size: 0.83rem; color: #94a3b8; margin-top: 0.1rem; }

    .et-status-badge {
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      white-space: nowrap;
      background: #f1f5f9;
      color: #64748b;
    }

    .et-status-approved  { background: #dcfce7; color: #166534; }
    .et-status-pending   { background: #fef9c3; color: #854d0e; }
    .et-status-revision  { background: #fce7f3; color: #9d174d; }

    @media (max-width: 960px) {
      .et-stats-row { grid-template-columns: repeat(3, 1fr); }
      .et-action-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 600px) {
      .et-stats-row { grid-template-columns: 1fr 1fr; }
    }
    /* ─── end External Training ─── */

    .utility-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: calc(1rem * var(--ui-scale));
    }

    .utility-card {
      display: grid;
      gap: calc(0.5rem * var(--ui-scale));
      padding: calc(0.85rem * var(--ui-scale));
      border-radius: calc(12px * var(--ui-scale));
      background: #f8fafc;
      border: 1px solid #e6edf5;
    }

    .utility-card-title {
      color: #14213d;
      font-size: calc(1rem * var(--ui-scale));
      font-weight: 700;
    }

    .utility-card-copy {
      margin: 0;
      color: #64748b;
      font-size: calc(0.92rem * var(--ui-scale));
      line-height: 1.5;
      display: block;
    }

    .mentorship-stack {
      display: grid;
      gap: calc(0.9rem * var(--ui-scale));
    }

    .mentorship-item {
      border: 1px solid #e6edf5;
      border-radius: calc(18px * var(--ui-scale));
      background: #f8fafc;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .mentorship-item-active {
      border-color: rgba(99, 102, 241, 0.25);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
    }

    .mentorship-item-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(1rem * var(--ui-scale));
      width: 100%;
      padding: calc(1rem * var(--ui-scale));
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }

    .mentorship-item-trailing {
      display: inline-flex;
      align-items: center;
      gap: calc(0.7rem * var(--ui-scale));
      flex: 0 0 auto;
    }

    .mentorship-item-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: calc(0.35rem * var(--ui-scale)) calc(0.65rem * var(--ui-scale));
      border-radius: 999px;
      background: #e2e8f0;
      color: #475569;
      font-size: calc(0.75rem * var(--ui-scale));
      font-weight: 800;
      white-space: nowrap;
    }

    .mentorship-item-status-saved {
      background: #dcfce7;
      color: #15803d;
    }

    .mentorship-item-trigger:hover,
    .mentorship-item-trigger:focus-visible {
      background: rgba(255, 255, 255, 0.75);
      outline: none;
    }

    .mentorship-item-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2rem * var(--ui-scale));
      height: calc(2rem * var(--ui-scale));
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.1);
      color: var(--brand-primary);
      font-size: calc(0.95rem * var(--ui-scale));
      font-weight: 700;
      flex: 0 0 auto;
    }

    .mentorship-dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.28);
      backdrop-filter: blur(4px);
      z-index: 119;
    }

    .mentorship-dialog {
      position: fixed;
      top: 1.25rem;
      bottom: 1.25rem;
      left: 50%;
      z-index: 120;
      width: min(calc(920px * var(--ui-scale)), calc(100vw - 2rem));
      overflow: auto;
      transform: translateX(-50%);
      display: grid;
      gap: calc(1rem * var(--ui-scale));
      padding: calc(1.2rem * var(--ui-scale));
      border: 1px solid #dce6f1;
      border-radius: calc(24px * var(--ui-scale));
      background: #fff;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
    }

    .mentorship-section-dialog {
      gap: calc(0.35rem * var(--ui-scale));
      align-content: start;
    }

    .mentorship-dialog-close {
      justify-self: end;
      position: sticky;
      top: 0;
      border: 1px solid #d7e2ee;
      border-radius: calc(14px * var(--ui-scale));
      padding: calc(0.7rem * var(--ui-scale)) calc(1rem * var(--ui-scale));
      background: #f8fafc;
      color: #334155;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .mentorship-dialog-close:hover,
    .mentorship-dialog-close:focus-visible {
      background: #eef2f7;
      outline: none;
    }

    .mentorship-section-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      justify-self: end;
      align-self: start;
      position: sticky;
      top: 0;
      z-index: 1;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: calc(12px * var(--ui-scale));
      padding: calc(0.52rem * var(--ui-scale)) calc(1rem * var(--ui-scale));
      background: linear-gradient(135deg, #6d84ff, #5269de);
      color: #ffffff;
      font: inherit;
      font-size: calc(0.82rem * var(--ui-scale));
      font-weight: 700;
      line-height: 1;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 10px 20px rgba(82, 105, 222, 0.2);
      cursor: pointer;
    }

    .mentorship-section-close:hover,
    .mentorship-section-close:focus-visible {
      background: linear-gradient(135deg, #7a90ff, #5c73e6);
      outline: none;
    }

    .mentorship-content-box {
      display: grid;
      gap: calc(0.9rem * var(--ui-scale));
      padding: calc(1rem * var(--ui-scale));
      border: 1px solid #dce6f1;
      border-radius: calc(20px * var(--ui-scale));
      background: #fff;
      box-shadow: 0 16px 34px rgba(15, 23, 42, 0.06);
    }

    .mentorship-content-inner {
      display: grid;
      gap: calc(1rem * var(--ui-scale));
    }

    .mentorship-profile-form {
      display: grid;
      gap: calc(1rem * var(--ui-scale));
      margin-top: calc(0.9rem * var(--ui-scale));
    }

    .mentorship-objectives-form {
      display: grid;
      gap: calc(1rem * var(--ui-scale));
    }

    .mentorship-form-report {
      display: grid;
      gap: calc(1rem * var(--ui-scale));
    }

    .mentorship-list-group {
      display: grid;
      gap: calc(0.85rem * var(--ui-scale));
    }

    .mentorship-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(0.85rem * var(--ui-scale));
      color: #334155;
      font-size: calc(0.9rem * var(--ui-scale));
      font-weight: 700;
    }

    .mentorship-list-items {
      display: grid;
      gap: calc(0.55rem * var(--ui-scale));
    }

    .mentorship-progress-rows {
      display: grid;
      gap: calc(0.55rem * var(--ui-scale));
    }

    .mentorship-list-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: calc(0.6rem * var(--ui-scale));
      align-items: center;
      padding: calc(0.6rem * var(--ui-scale)) calc(0.7rem * var(--ui-scale));
      border: 1px solid #dce6f1;
      border-radius: calc(14px * var(--ui-scale));
      background: #fbfdff;
    }

    .mentorship-objective-row {
      grid-template-columns: auto minmax(0, 1fr) minmax(132px, 0.52fr) minmax(156px, 0.62fr) auto;
      gap: calc(0.5rem * var(--ui-scale));
      padding: calc(0.5rem * var(--ui-scale)) calc(0.6rem * var(--ui-scale));
      border-radius: calc(12px * var(--ui-scale));
    }

    .mentorship-progress-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) minmax(132px, 0.52fr) auto;
      gap: calc(0.5rem * var(--ui-scale));
      align-items: center;
      padding: calc(0.5rem * var(--ui-scale)) calc(0.6rem * var(--ui-scale));
      border: 1px solid #dce6f1;
      border-radius: calc(12px * var(--ui-scale));
      background: #fbfdff;
    }

    .mentorship-row-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(1.8rem * var(--ui-scale));
      height: calc(1.8rem * var(--ui-scale));
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.12);
      color: var(--brand-primary);
      font-size: calc(0.82rem * var(--ui-scale));
      font-weight: 800;
      flex: 0 0 auto;
    }

    .mentorship-form-field-compact {
      gap: calc(0.25rem * var(--ui-scale));
    }

    .mentorship-form-field-compact span {
      font-size: calc(0.74rem * var(--ui-scale));
    }

    .mentorship-progress-date {
      min-width: 0;
    }

    .mentorship-objective-date {
      min-width: 0;
    }

    .mentorship-objective-date input {
      min-width: 0;
      padding-inline: calc(0.7rem * var(--ui-scale));
    }

    .mentorship-progress-date input {
      min-width: 0;
      padding-inline: calc(0.7rem * var(--ui-scale));
    }

    .mentorship-list-action,
    .mentorship-list-remove {
      border: 1px solid #d7e2ee;
      border-radius: calc(12px * var(--ui-scale));
      padding: calc(0.5rem * var(--ui-scale)) calc(0.75rem * var(--ui-scale));
      background: #fff;
      color: #334155;
      font: inherit;
      font-size: calc(0.8rem * var(--ui-scale));
      font-weight: 700;
      cursor: pointer;
    }

    .mentorship-list-action:hover,
    .mentorship-list-action:focus-visible,
    .mentorship-list-remove:hover,
    .mentorship-list-remove:focus-visible {
      background: #eef2f7;
      outline: none;
    }

    .mentorship-list-remove[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
      background: #fff;
    }

    .mentorship-objectives-intro {
      padding: calc(0.9rem * var(--ui-scale));
      border-radius: calc(16px * var(--ui-scale));
      background: rgba(99, 102, 241, 0.06);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }

    .mentorship-program-form {
      padding: calc(1.15rem * var(--ui-scale));
      border: 1px solid rgba(109, 132, 255, 0.2);
      border-radius: calc(24px * var(--ui-scale));
      background: linear-gradient(180deg, #ffffff 0%, #fcfcff 100%);
      box-shadow: 0 20px 42px rgba(99, 102, 241, 0.08);
    }

    .mentorship-program-hero {
      display: grid;
      justify-items: center;
      gap: calc(0.3rem * var(--ui-scale));
      padding: calc(0.1rem * var(--ui-scale)) 0 calc(0.95rem * var(--ui-scale));
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
      text-align: center;
    }

    .mentorship-program-hero h3 {
      margin: 0;
      color: #14213d;
      font-size: calc(1.45rem * var(--ui-scale));
      font-weight: 800;
    }

    .mentorship-program-hero p {
      margin: 0;
      color: #94a3b8;
      font-size: calc(0.86rem * var(--ui-scale));
    }

    .mentorship-program-card {
      padding: calc(0.85rem * var(--ui-scale));
      border: 1px solid #dbe3f3;
      border-radius: calc(18px * var(--ui-scale));
      background: linear-gradient(180deg, #fafbff 0%, #f6f8ff 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
    }

    .mentorship-program-card-header {
      padding-inline: calc(0.1rem * var(--ui-scale));
      color: #14213d;
    }

    .mentorship-program-card-title-shell {
      display: inline-flex;
      align-items: center;
      gap: calc(0.45rem * var(--ui-scale));
      min-width: 0;
    }

    .mentorship-program-card-title {
      font-size: calc(0.98rem * var(--ui-scale));
      font-weight: 800;
    }

    .mentorship-program-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: calc(1.25rem * var(--ui-scale));
      height: calc(1.25rem * var(--ui-scale));
      padding-inline: calc(0.25rem * var(--ui-scale));
      border-radius: 999px;
      background: #6d84ff;
      color: #ffffff;
      font-size: calc(0.72rem * var(--ui-scale));
      font-weight: 800;
      line-height: 1;
    }

    .mentorship-program-add {
      border-color: rgba(109, 132, 255, 0.18);
      background: linear-gradient(135deg, #6d84ff, #566ee0);
      color: #ffffff;
      box-shadow: 0 10px 18px rgba(82, 105, 222, 0.16);
    }

    .mentorship-program-add:hover,
    .mentorship-program-add:focus-visible {
      background: linear-gradient(135deg, #7a90ff, #6077ea);
      color: #ffffff;
    }

    .mentorship-program-card-body {
      gap: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-program-entry {
      grid-template-columns: minmax(0, 1fr);
      gap: calc(0.8rem * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale));
      border-radius: calc(14px * var(--ui-scale));
      background: #ffffff;
      border: 1px solid #d7e2ef;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
    }

    .mentorship-program-entry-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-program-entry-heading {
      display: inline-flex;
      align-items: center;
      gap: calc(0.55rem * var(--ui-scale));
      min-width: 0;
    }

    .mentorship-program-entry .mentorship-row-number {
      width: calc(1.55rem * var(--ui-scale));
      height: calc(1.55rem * var(--ui-scale));
      background: #eef2ff;
      color: #64748b;
      font-size: calc(0.72rem * var(--ui-scale));
    }

    .mentorship-program-entry-label {
      color: #14213d;
      font-size: calc(0.9rem * var(--ui-scale));
      font-weight: 700;
    }

    .mentorship-program-field {
      gap: calc(0.35rem * var(--ui-scale));
    }

    .mentorship-program-field span {
      color: #475569;
      font-size: calc(0.68rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .mentorship-program-form input {
      border: 1px solid #d5dfed;
      border-radius: calc(8px * var(--ui-scale));
      background: #ffffff;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
    }

    .mentorship-program-date-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-program-remove {
      border-color: rgba(248, 113, 113, 0.18);
      background: #fff1f2;
      color: #ef4444;
      padding: calc(0.34rem * var(--ui-scale)) calc(0.65rem * var(--ui-scale));
      font-size: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-program-remove:hover,
    .mentorship-program-remove:focus-visible {
      background: #ffe4e6;
      color: #dc2626;
    }

    .mentorship-program-remove[disabled] {
      background: #fff5f5;
      color: #f4a3a9;
      border-color: rgba(248, 113, 113, 0.12);
    }

    .mentorship-program-actions {
      justify-content: center;
      gap: calc(0.75rem * var(--ui-scale));
      padding-top: calc(0.2rem * var(--ui-scale));
    }

    .mentorship-program-actions .mentorship-form-status {
      width: 100%;
      text-align: center;
    }

    .mentorship-program-actions .mentorship-save-button {
      min-width: calc(9rem * var(--ui-scale));
      justify-content: center;
    }

    .mentorship-progress-program-form {
      padding: calc(1.15rem * var(--ui-scale));
      border: 1px solid rgba(14, 165, 233, 0.22);
      border-radius: calc(24px * var(--ui-scale));
      background: linear-gradient(180deg, #ffffff 0%, #fcfeff 100%);
      box-shadow: 0 20px 42px rgba(14, 165, 233, 0.08);
    }

    .mentorship-progress-hero {
      display: grid;
      justify-items: center;
      gap: calc(0.28rem * var(--ui-scale));
      padding: calc(0.1rem * var(--ui-scale)) 0 calc(0.95rem * var(--ui-scale));
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
      text-align: center;
    }

    .mentorship-progress-hero h3 {
      margin: 0;
      color: #0f2d8c;
      font-size: calc(1.32rem * var(--ui-scale));
      font-weight: 800;
    }

    .mentorship-progress-hero p {
      margin: 0;
      color: #94a3b8;
      font-size: calc(0.84rem * var(--ui-scale));
    }

    .mentorship-progress-panel {
      display: grid;
      gap: calc(0.85rem * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale));
      border: 1px solid #d8e4f4;
      border-radius: calc(16px * var(--ui-scale));
      background: linear-gradient(180deg, #f8fbff 0%, #f3f7fd 100%);
    }

    .mentorship-progress-panel-meeting {
      padding-bottom: calc(1rem * var(--ui-scale));
    }

    .mentorship-progress-panel-header {
      color: #0f2d8c;
    }

    .mentorship-progress-title-shell {
      display: inline-flex;
      align-items: center;
      gap: calc(0.65rem * var(--ui-scale));
      min-width: 0;
    }

    .mentorship-progress-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(1.6rem * var(--ui-scale));
      height: calc(1.6rem * var(--ui-scale));
      border-radius: calc(0.5rem * var(--ui-scale));
      background: linear-gradient(135deg, #1d4ed8, #22d3ee);
      color: #ffffff;
      box-shadow: 0 10px 18px rgba(34, 211, 238, 0.18);
      flex: 0 0 auto;
    }

    .mentorship-progress-icon svg {
      width: calc(0.9rem * var(--ui-scale));
      height: calc(0.9rem * var(--ui-scale));
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .mentorship-progress-icon-comments svg {
      width: calc(0.85rem * var(--ui-scale));
      height: calc(0.85rem * var(--ui-scale));
    }

    .mentorship-progress-title {
      color: #0f2d8c;
      font-size: calc(0.96rem * var(--ui-scale));
      font-weight: 800;
    }

    .mentorship-progress-add {
      border-color: rgba(29, 78, 216, 0.15);
      background: linear-gradient(135deg, #1d4ed8, #22d3ee);
      color: #ffffff;
      box-shadow: 0 10px 18px rgba(29, 78, 216, 0.16);
    }

    .mentorship-progress-add:hover,
    .mentorship-progress-add:focus-visible {
      background: linear-gradient(135deg, #2563eb, #34d3ff);
      color: #ffffff;
    }

    .mentorship-progress-list {
      gap: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-progress-entry {
      grid-template-columns: minmax(0, 1fr);
      gap: calc(0.75rem * var(--ui-scale));
      padding: calc(0.85rem * var(--ui-scale)) calc(0.9rem * var(--ui-scale));
      border-left: 4px solid #22d3ee;
      border-radius: calc(0.85rem * var(--ui-scale));
      background: #ffffff;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
    }

    .mentorship-progress-entry-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-progress-entry-heading {
      display: inline-flex;
      align-items: center;
      gap: calc(0.55rem * var(--ui-scale));
      min-width: 0;
    }

    .mentorship-progress-entry .mentorship-row-number {
      width: calc(1.55rem * var(--ui-scale));
      height: calc(1.55rem * var(--ui-scale));
      background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
      color: #ffffff;
      font-size: calc(0.72rem * var(--ui-scale));
      box-shadow: 0 8px 14px rgba(29, 78, 216, 0.18);
    }

    .mentorship-progress-state {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: calc(0.28rem * var(--ui-scale)) calc(0.6rem * var(--ui-scale));
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
      font-size: calc(0.66rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .mentorship-progress-field {
      gap: calc(0.38rem * var(--ui-scale));
    }

    .mentorship-progress-field span {
      color: #475569;
      font-size: calc(0.68rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .mentorship-progress-program-form input,
    .mentorship-progress-program-form textarea {
      border: 1px solid #d5dfed;
      border-radius: calc(8px * var(--ui-scale));
      background: #ffffff;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
    }

    .mentorship-progress-meeting-field {
      max-width: calc(14rem * var(--ui-scale));
    }

    .mentorship-progress-description-field {
      max-width: 100%;
    }

    .mentorship-progress-date-field {
      max-width: calc(10rem * var(--ui-scale));
    }

    .mentorship-progress-remove {
      border-color: rgba(248, 113, 113, 0.16);
      background: #fff1f2;
      color: #ef4444;
      padding: calc(0.34rem * var(--ui-scale)) calc(0.65rem * var(--ui-scale));
      font-size: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-progress-remove:hover,
    .mentorship-progress-remove:focus-visible {
      background: #ffe4e6;
      color: #dc2626;
    }

    .mentorship-progress-remove[disabled] {
      background: #fff5f5;
      color: #f4a3a9;
      border-color: rgba(248, 113, 113, 0.12);
    }

    .mentorship-progress-comments-title-shell {
      margin-bottom: calc(0.1rem * var(--ui-scale));
    }

    .mentorship-progress-comments-field textarea {
      min-height: calc(7rem * var(--ui-scale));
      resize: vertical;
    }

    .mentorship-progress-visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .mentorship-progress-actions {
      justify-content: center;
      gap: calc(0.75rem * var(--ui-scale));
      padding-top: calc(0.25rem * var(--ui-scale));
    }

    .mentorship-progress-actions .mentorship-form-status {
      width: 100%;
      text-align: center;
    }

    .mentorship-progress-actions .mentorship-save-button {
      min-width: calc(9rem * var(--ui-scale));
      justify-content: center;
      background: linear-gradient(135deg, #1d4ed8, #22d3ee);
      box-shadow: 0 14px 28px rgba(29, 78, 216, 0.18);
    }

    .mentorship-profile-program-form {
      padding: 0;
      border: 1px solid rgba(20, 58, 74, 0.18);
      border-radius: calc(24px * var(--ui-scale));
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 28%);
      box-shadow: 0 24px 52px rgba(15, 23, 42, 0.12);
      overflow: clip;
    }

    .mentorship-profile-program-hero {
      position: relative;
      display: grid;
      justify-items: center;
      gap: calc(0.85rem * var(--ui-scale));
      padding: calc(1.35rem * var(--ui-scale)) calc(1rem * var(--ui-scale)) calc(1.6rem * var(--ui-scale));
      background: linear-gradient(180deg, #1f3b47 0%, #1c3340 100%);
      color: #ffffff;
      text-align: center;
    }

    .mentorship-profile-program-hero-top {
      display: grid;
      justify-items: center;
      gap: calc(0.75rem * var(--ui-scale));
    }

    .mentorship-profile-program-avatar {
      position: relative;
      width: calc(4.7rem * var(--ui-scale));
      height: calc(4.7rem * var(--ui-scale));
      border: 2px solid rgba(255, 255, 255, 0.38);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.24);
    }

    .mentorship-profile-program-avatar-badge {
      position: absolute;
      right: -0.1rem;
      bottom: -0.1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(1.35rem * var(--ui-scale));
      height: calc(1.35rem * var(--ui-scale));
      border: 2px solid #ffffff;
      border-radius: 999px;
      background: #ffffff;
      color: #1f3b47;
      box-shadow: 0 8px 16px rgba(15, 23, 42, 0.16);
    }

    .mentorship-profile-program-avatar-badge svg {
      width: calc(0.78rem * var(--ui-scale));
      height: calc(0.78rem * var(--ui-scale));
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .mentorship-profile-program-copy {
      justify-items: center;
      gap: 0.18rem;
    }

    .mentorship-profile-program-name {
      color: #ffffff;
      font-size: calc(1.2rem * var(--ui-scale));
      font-weight: 800;
    }

    .mentorship-profile-program-subtitle {
      color: rgba(255, 255, 255, 0.82);
      font-size: calc(0.84rem * var(--ui-scale));
      font-weight: 500;
    }

    .mentorship-profile-program-notch {
      position: absolute;
      bottom: calc(-0.85rem * var(--ui-scale));
      width: calc(2.1rem * var(--ui-scale));
      height: calc(2.1rem * var(--ui-scale));
      border-radius: 999px;
      background: #ffffff;
      box-shadow: 0 10px 18px rgba(15, 23, 42, 0.06);
    }

    .mentorship-profile-program-panel {
      display: grid;
      gap: calc(0.95rem * var(--ui-scale));
      margin-inline: calc(1.1rem * var(--ui-scale));
      padding: calc(1rem * var(--ui-scale));
      border: 1px solid #dde6f3;
      border-radius: calc(18px * var(--ui-scale));
      background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
      box-shadow: 0 12px 26px rgba(15, 23, 42, 0.05);
    }

    .mentorship-profile-program-panel-mentee {
      margin-top: calc(0.5rem * var(--ui-scale));
    }

    .mentorship-profile-program-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(0.8rem * var(--ui-scale));
      padding-bottom: calc(0.8rem * var(--ui-scale));
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    }

    .mentorship-profile-program-panel-title-shell {
      display: inline-flex;
      align-items: center;
      gap: calc(0.7rem * var(--ui-scale));
      min-width: 0;
    }

    .mentorship-profile-program-panel-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(1.55rem * var(--ui-scale));
      height: calc(1.55rem * var(--ui-scale));
      border-radius: calc(0.48rem * var(--ui-scale));
      color: #ffffff;
      flex: 0 0 auto;
      box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
    }

    .mentorship-profile-program-panel-icon svg {
      width: calc(0.82rem * var(--ui-scale));
      height: calc(0.82rem * var(--ui-scale));
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .mentorship-profile-program-panel-icon-mentee {
      background: linear-gradient(135deg, #7c3aed, #a855f7);
    }

    .mentorship-profile-program-panel-icon-mentor {
      background: linear-gradient(135deg, #ec4899, #fb7185);
    }

    .mentorship-profile-program-panel-title {
      color: #14213d;
      font-size: calc(1rem * var(--ui-scale));
      font-weight: 800;
    }

    .mentorship-profile-program-panel-copy {
      margin: 0;
      color: #94a3b8;
      font-size: calc(0.78rem * var(--ui-scale));
      line-height: 1.4;
    }

    .mentorship-profile-program-grid {
      gap: calc(0.85rem * var(--ui-scale));
    }

    .mentorship-profile-program-field {
      gap: calc(0.35rem * var(--ui-scale));
    }

    .mentorship-profile-program-field span {
      color: #0f172a;
      font-size: calc(0.68rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .mentorship-profile-program-form input,
    .mentorship-profile-program-form textarea {
      border: 1px solid #d7e1ed;
      border-radius: calc(8px * var(--ui-scale));
      background: #ffffff;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
    }

    .mentorship-profile-program-form textarea {
      min-height: calc(4.3rem * var(--ui-scale));
      resize: vertical;
    }

    .mentorship-profile-program-actions {
      justify-content: center;
      gap: calc(0.75rem * var(--ui-scale));
      padding: 0 calc(1.1rem * var(--ui-scale)) calc(1.25rem * var(--ui-scale));
    }

    .mentorship-profile-program-actions .mentorship-form-status {
      width: 100%;
      text-align: center;
    }

    .mentorship-profile-program-actions .mentorship-save-button {
      min-width: calc(10rem * var(--ui-scale));
      justify-content: center;
      background: linear-gradient(135deg, #163642, #356173);
      box-shadow: 0 14px 28px rgba(22, 54, 66, 0.2);
    }

    .mentorship-profile-header {
      display: flex;
      align-items: center;
      gap: calc(0.9rem * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale));
      border-radius: calc(18px * var(--ui-scale));
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(14, 165, 233, 0.08));
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .mentorship-profile-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(4.5rem * var(--ui-scale));
      height: calc(4.5rem * var(--ui-scale));
      border-radius: 999px;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      font-size: calc(1.25rem * var(--ui-scale));
      font-weight: 800;
      overflow: hidden;
      flex: 0 0 auto;
    }

    .mentorship-profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .mentorship-profile-avatar-has-image {
      background: #fff;
    }

    .mentorship-profile-header-copy {
      display: grid;
      gap: 0.2rem;
    }

    .mentorship-profile-name {
      color: #14213d;
      font-size: calc(1.05rem * var(--ui-scale));
      font-weight: 700;
    }

    .mentorship-profile-subtitle {
      margin: 0;
      color: #64748b;
      font-size: calc(0.9rem * var(--ui-scale));
    }

    .mentorship-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: calc(0.85rem * var(--ui-scale));
    }

    .external-training-request-form {
      width: auto;
      margin: 0;
      padding: 24px 28px 28px;
      background: #ffffff;
    }

    .external-training-request-grid {
      width: 100%;
      grid-template-columns: minmax(0, 1fr);
      gap: calc(1rem * var(--ui-scale));
      align-items: start;
      min-width: 0;
    }

    .external-training-request-dialog {
      top: 20px;
      bottom: 20px;
      width: min(880px, calc(100vw - 24px));
      display: block;
      padding: 0;
      gap: 0;
      border: none;
      background: transparent;
      box-shadow: none;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .mentorship-content-box.external-training-request-card {
      display: block;
      height: max-content;
      min-height: max-content;
      padding: 0;
      border: 1px solid #dbe5f3;
      border-radius: calc(16px * var(--ui-scale));
      background: #f5f7fb;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
      overflow: clip;
    }

    .external-training-request-close {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 1;
      border-color: rgba(255, 255, 255, 0.24);
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      backdrop-filter: blur(10px);
    }

    .external-training-request-close:hover,
    .external-training-request-close:focus-visible {
      background: rgba(255, 255, 255, 0.24);
      color: #ffffff;
    }

    .external-training-request-hero {
      position: relative;
      display: flex;
      align-items: flex-start;
      overflow: hidden;
      min-height: 120px;
      padding: 28px 28px 22px;
      background: linear-gradient(135deg, #3567df 0%, #2853c6 55%, #4361d3 100%);
      color: #ffffff;
      box-sizing: border-box;
    }

    .external-training-request-hero::after {
      content: '';
      position: absolute;
      top: calc(-2.1rem * var(--ui-scale));
      right: calc(-2.3rem * var(--ui-scale));
      width: calc(13rem * var(--ui-scale));
      height: calc(13rem * var(--ui-scale));
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
    }

    .external-training-request-hero-copy {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 8px;
      max-width: calc(100% - 112px);
      padding-right: 96px;
    }

    .external-training-request-hero-copy h3 {
      margin: 0;
      font-size: 30px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: #ffffff;
    }

    .external-training-request-hero-copy p {
      margin: 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 15px;
      line-height: 1.5;
    }

    .external-training-request-field {
      gap: 8px;
      min-width: 0;
    }

    .external-training-request-field > span {
      color: #374151;
      font-size: 16px;
      font-weight: 700;
    }

    .external-training-request-required {
      color: #ef4444;
      font-weight: 800;
    }

    .external-training-request-field input:not([type='file']),
    .external-training-request-field select {
      width: 100%;
      max-width: 100%;
      min-height: 56px;
      border: 1px solid #d6deeb;
      border-radius: 12px;
      background: #ffffff;
      padding: 14px 16px;
      color: #1f2937;
      font: inherit;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .external-training-request-field select {
      padding-right: 44px;
      appearance: none;
      background-image:
        linear-gradient(45deg, transparent 50%, #6b7280 50%),
        linear-gradient(135deg, #6b7280 50%, transparent 50%);
      background-position:
        calc(100% - calc(1.15rem * var(--ui-scale))) calc(50% - calc(0.16rem * var(--ui-scale))),
        calc(100% - calc(0.82rem * var(--ui-scale))) calc(50% - calc(0.16rem * var(--ui-scale)));
      background-size: calc(0.42rem * var(--ui-scale)) calc(0.42rem * var(--ui-scale));
      background-repeat: no-repeat;
    }

    .external-training-request-field input::placeholder {
      color: #9aa4b2;
    }

    .external-training-request-field input:not([type='file']):focus,
    .external-training-request-field select:focus {
      border-color: #3567df;
      box-shadow: 0 0 0 3px rgba(53, 103, 223, 0.14);
      outline: none;
    }

    .external-training-request-upload-field {
      gap: calc(0.6rem * var(--ui-scale));
      padding: calc(0.2rem * var(--ui-scale)) 0 0;
    }

    .external-training-request-file-input {
      width: 100%;
      border: 1px dashed #c8d5ea;
      border-radius: calc(14px * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale));
      background: #f8fbff;
      color: #475569;
      font: inherit;
      box-sizing: border-box;
    }

    .external-training-request-file-input::file-selector-button {
      margin-right: calc(0.75rem * var(--ui-scale));
      border: none;
      border-radius: calc(10px * var(--ui-scale));
      padding: calc(0.65rem * var(--ui-scale)) calc(0.95rem * var(--ui-scale));
      background: #e8f0ff;
      color: #2853c6;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .external-training-request-support-copy {
      color: #6b7280;
      font-size: calc(0.85rem * var(--ui-scale));
    }

    .external-training-request-actions {
      justify-content: space-between;
      align-items: center;
      gap: calc(1rem * var(--ui-scale));
      padding-top: calc(0.5rem * var(--ui-scale));
    }

    .external-training-request-status {
      margin: 0;
      color: #2853c6;
      font-weight: 700;
    }

    .external-training-request-submit {
      min-height: calc(3.2rem * var(--ui-scale));
      padding-inline: calc(1.35rem * var(--ui-scale));
      border-radius: 999px;
      background: linear-gradient(135deg, #3567df, #2853c6);
      box-shadow: 0 16px 28px rgba(40, 83, 198, 0.2);
    }

    .external-training-request-submit:disabled {
      box-shadow: none;
      opacity: 0.65;
    }

    .external-training-status-dialog {
      align-content: start;
    }

    .external-training-status-card {
      position: relative;
      align-self: start;
    }

    .external-training-status-close {
      border-color: #c7d8f8;
      background: #eef4ff;
      color: #2853c6;
      backdrop-filter: none;
      box-shadow: 0 10px 22px rgba(40, 83, 198, 0.12);
    }

    .external-training-status-close:hover,
    .external-training-status-close:focus-visible {
      background: #dfeaff;
      color: #1e40af;
    }

    .external-training-status-shell {
      position: relative;
    }

    .external-training-status-list {
      display: grid;
      gap: calc(0.85rem * var(--ui-scale));
    }

    .external-training-status-list-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: calc(1rem * var(--ui-scale));
      width: 100%;
      border: 1px solid #dbe5f3;
      border-radius: calc(18px * var(--ui-scale));
      padding: calc(1rem * var(--ui-scale)) calc(1.1rem * var(--ui-scale));
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      color: #14213d;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }

    .external-training-status-list-item:hover,
    .external-training-status-list-item:focus-visible,
    .external-training-status-list-item-active {
      border-color: #3567df;
      box-shadow: 0 14px 28px rgba(53, 103, 223, 0.14);
      transform: translateY(-1px);
      outline: none;
    }

    .external-training-status-list-copy,
    .external-training-status-list-meta,
    .external-training-status-detail-header-actions,
    .external-training-status-detail-actions {
      display: grid;
      gap: calc(0.35rem * var(--ui-scale));
    }

    .external-training-status-list-copy span,
    .external-training-status-list-date,
    .external-training-status-list-link,
    .external-training-status-detail-header p,
    .external-training-status-detail-documents strong {
      color: #64748b;
      font-size: calc(0.9rem * var(--ui-scale));
    }

    .external-training-status-list-meta {
      justify-items: end;
      flex: 0 0 auto;
    }

    .external-training-status-list-link {
      color: #2853c6;
      font-weight: 700;
    }

    .external-training-status-detail-overlay {
      position: absolute;
      inset: 0;
      display: grid;
      align-items: start;
      padding: calc(0.5rem * var(--ui-scale));
      background: rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(2px);
    }

    .external-training-status-detail-box {
      display: grid;
      gap: calc(1rem * var(--ui-scale));
      max-height: calc(100vh - 10rem);
      overflow: auto;
      border: 1px solid #cfe0f7;
      border-radius: calc(22px * var(--ui-scale));
      padding: calc(1.2rem * var(--ui-scale));
      background: #ffffff;
      box-shadow: 0 28px 54px rgba(15, 23, 42, 0.2);
    }

    .external-training-status-detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: calc(1rem * var(--ui-scale));
    }

    .external-training-status-detail-header h4 {
      margin: 0;
      color: #14213d;
      font-size: calc(1.3rem * var(--ui-scale));
    }

    .external-training-status-detail-header p {
      margin: calc(0.35rem * var(--ui-scale)) 0 0;
    }

    .external-training-status-detail-header-actions {
      justify-items: end;
    }

    .external-training-status-detail-close,
    .external-training-status-detail-action {
      border: 1px solid #d7e2ee;
      border-radius: 999px;
      padding: calc(0.7rem * var(--ui-scale)) calc(1rem * var(--ui-scale));
      background: #f8fafc;
      color: #1e3a8a;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .external-training-status-detail-close:hover,
    .external-training-status-detail-close:focus-visible,
    .external-training-status-detail-action:hover,
    .external-training-status-detail-action:focus-visible {
      background: #eef4ff;
      border-color: #b7cdf5;
      outline: none;
    }

    .external-training-status-detail-documents {
      display: grid;
      gap: calc(0.75rem * var(--ui-scale));
      padding-top: calc(0.25rem * var(--ui-scale));
      border-top: 1px solid #e2e8f0;
    }

    @media (max-width: 960px) {
      .profile-layout {
        grid-template-columns: 1fr;
      }

      .profile-layout.profile-layout-side-panel-collapsed {
        grid-template-columns: 1fr;
      }

      .side-panel {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        align-items: stretch;
        position: static;
        height: auto;
        overflow: visible;
      }

      .side-panel-header {
        grid-column: 1 / -1;
        justify-content: flex-end;
      }

      .side-panel-collapsed {
        padding-inline: calc(1rem * var(--ui-scale));
      }

      .side-panel-collapsed button {
        justify-content: flex-start;
      }

      .side-panel-collapsed .side-panel-label {
        display: inline;
      }

      .side-panel-collapsed .side-panel-toggle {
        width: calc(2.5rem * var(--ui-scale));
      }

      .side-panel button.logout {
        margin-top: 0;
      }
    }

    @media (max-width: 720px) {
      .profile-shell {
        padding: 0.75rem;
      }

      .profile-topbar {
        flex-direction: column;
        align-items: stretch;
        padding: 1rem;
      }

      .topbar-icons {
        justify-content: space-between;
        flex-wrap: wrap;
      }

      .profile-menu-wrap {
        width: 100%;
      }

      .profile-menu-trigger {
        width: 100%;
        justify-content: flex-start;
      }

      .profile-menu-panel {
        left: 0;
        right: auto;
        width: 100%;
      }

      .support-section {
        padding: 1rem;
        border-radius: 20px;
      }

      .section-heading-row {
        flex-direction: column;
      }

      .mentorship-dialog {
        width: calc(100vw - 1.25rem);
        top: 0.625rem;
        bottom: 0.625rem;
        padding: 1rem;
      }

      .external-training-request-dialog {
        top: 10px;
        bottom: 10px;
        width: calc(100vw - 12px);
        padding: 0;
      }

      .external-training-request-hero {
        min-height: 104px;
        padding: 22px 18px 18px;
      }

      .external-training-request-hero-copy {
        max-width: calc(100% - 88px);
        padding-right: 76px;
      }

      .external-training-request-form {
        padding: 18px 16px 20px;
      }

      .external-training-request-close {
        top: 12px;
        right: 12px;
      }

      .mentorship-form-actions {
        flex-direction: column;
        align-items: flex-start;
      }

      .mentorship-profile-header,
      .mentorship-form-actions {
        flex-direction: column;
        align-items: flex-start;
      }

      .mentorship-form-grid {
        grid-template-columns: 1fr;
      }

      .external-training-status-list-item,
      .external-training-status-detail-header {
        flex-direction: column;
        align-items: stretch;
      }

      .external-training-status-list-meta,
      .external-training-status-detail-header-actions {
        justify-items: start;
      }

      .external-training-status-detail-box {
        max-height: calc(100vh - 7.5rem);
      }

      .mentorship-list-header,
      .mentorship-list-item {
        grid-template-columns: 1fr;
        flex-direction: column;
        align-items: stretch;
      }

      .mentorship-objective-row,
      .mentorship-progress-row {
        grid-template-columns: 1fr;
      }

      .mentorship-row-number {
        margin-bottom: 0.15rem;
      }

      .mentorship-program-card-header,
      .mentorship-program-entry-top {
        flex-direction: column;
        align-items: stretch;
      }

      .mentorship-program-date-grid {
        grid-template-columns: 1fr;
      }

      .mentorship-program-actions {
        align-items: stretch;
      }

      .mentorship-program-actions .mentorship-save-button,
      .mentorship-program-actions .mentorship-list-action {
        width: 100%;
      }

      .mentorship-progress-panel-header,
      .mentorship-progress-entry-top {
        flex-direction: column;
        align-items: stretch;
      }

      .mentorship-progress-meeting-field,
      .mentorship-progress-date-field {
        max-width: 100%;
      }

      .mentorship-progress-actions {
        align-items: stretch;
      }

      .mentorship-progress-actions .mentorship-save-button,
      .mentorship-progress-actions .mentorship-list-action {
        width: 100%;
      }

      .mentorship-profile-program-panel-header,
      .mentorship-profile-program-title-shell,
      .mentorship-profile-program-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .mentorship-profile-program-panel {
        margin-inline: 0;
      }

      .mentorship-profile-program-notch {
        bottom: calc(-0.7rem * var(--ui-scale));
      }

      .mentorship-profile-program-actions .mentorship-save-button,
      .mentorship-profile-program-actions .mentorship-list-action {
        width: 100%;
      }

      .idp-program-entry-top {
        flex-direction: column;
        align-items: flex-start;
      }

      .idp-readonly-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class StudentProfileComponent implements OnInit, OnDestroy {
  // Manager-entered IDP entries shown in the student view as read-only.
  readonly managerIdpEntries = computed<StudentIdpEntry[]>(() => {
    const studentEmail = this.studentData.profile().email.trim().toLocaleLowerCase();
    if (!studentEmail) {
      return [];
    }

    const matchedStudent = this.managerData.students().find(
      (student) => student.email.trim().toLocaleLowerCase() === studentEmail,
    );
    if (!matchedStudent) {
      return [];
    }

    return this.managerData.idpEntriesByStudent()[matchedStudent.id] ?? [];
  });

  // Manager-entered KPI table shown in the student view — every field is read-only except
  // Employee scoring, which the student fills in themselves (see stageMyKpiEmployeeScoring /
  // submitMyKpiRatings).
  //
  // Resolves by live email match against the roster FIRST, with the session's studentId claim
  // only as a fallback. This is the opposite of an earlier version of this logic, which preferred
  // the session claim — that was itself a fix for a real bug (an unvalidated email fallback used
  // to occasionally pick the wrong roster row), but it assumed the session's claim always points
  // at the one true record for this person. In practice a person can end up with two roster rows
  // (e.g. a duplicate created during re-enrollment, or a profile recreated by an admin) — the
  // session's studentId claim, set once at login and never refreshed, can end up pinned to one of
  // them while the *current* roster the training manager actually looks at is the other. A stale
  // claim doesn't error, it just quietly reads and writes a different record than everyone else:
  // exactly what made a submitted rating "Saved" successfully and then read back as "Not scored"
  // on the next visit, while the manager's own view of the (different, current) record showed it
  // correctly the whole time. Email is what the roster is actually keyed on from a human's
  // perspective, so preferring a live match there is the more reliable signal; the session claim
  // is kept only for the window before the roster has loaded (or the rare case of no email on
  // file), where it's better than showing nothing. The server accepts writes resolved either way
  // (see isOwnStudentRecord in server.ts), so this can't cause the "saved locally, rejected on
  // the backend" failure mode the original session-first fix was written to avoid.
  readonly matchedKpiStudentId = computed<string | null>(() => {
    const students = this.managerData.students();
    const studentEmail = this.studentData.profile().email.trim().toLocaleLowerCase();
    const matchedStudent = studentEmail
      ? students.find((student) => student.email.trim().toLocaleLowerCase() === studentEmail)
      : undefined;

    if (matchedStudent) {
      return matchedStudent.id;
    }

    return readLmsSessionRecord()?.studentId?.trim() || null;
  });

  // Without this, *ngFor's default identity-based diffing sees a brand-new object on every
  // update (every save creates fresh entry objects) and destroys+recreates the whole <tr>,
  // including the Employee scoring <select> — which can lose the value it was just set to on
  // re-render before Angular gets a chance to re-bind it. Tracking by the stable entry id keeps
  // the DOM node in place and just updates its bound value instead.
  trackKpiEntryById(_index: number, entry: StudentKpiEntry): string {
    return entry.id;
  }

  // Which year's table is on screen — defaults to, and keeps following, the current (editable,
  // self-scoreable) year until the student deliberately picks a different one via selectKpiYear.
  // Kept as a follow, not a one-time init: the service's currentKpiYear signal starts out as a
  // same-calendar-year guess before bootstrap resolves, and a manager may open a new year at any
  // point during the session — either could otherwise leave this permanently pinned to a stale year.
  readonly selectedKpiYear = signal<number | null>(null);
  private hasManuallySelectedKpiYear = false;
  private readonly kpiYearFollowEffect = effect(() => {
    const currentYear = this.managerData.currentKpiYear();
    if (!this.hasManuallySelectedKpiYear) {
      this.selectedKpiYear.set(currentYear);
    }
  });
  readonly isViewingCurrentKpiYear = computed(() => this.selectedKpiYear() === this.managerData.currentKpiYear());

  readonly myKpiEntries = computed<StudentKpiEntry[]>(() => {
    const id = this.matchedKpiStudentId();
    const year = this.selectedKpiYear();
    if (!id || year === null) {
      return [];
    }

    return this.managerData.kpiEntriesForStudentYear(id, year);
  });

  selectKpiYear(year: number) {
    this.hasManuallySelectedKpiYear = true;
    this.selectedKpiYear.set(year);
    this.pendingEmployeeScoring.set({});
    this.kpiSubmitSaved.set(false);
    this.kpiSubmitError.set(false);

    const id = this.matchedKpiStudentId();
    if (id) {
      void this.managerData.fetchKpiEntriesForStudentYear(id, year);
    }
  }

  readonly myKpiTotalWeight = computed(() =>
    this.myKpiEntries().reduce((total, entry) => total + (entry.weight || 0), 0),
  );

  readonly kpiFullScreen = signal(false);

  // Weight-weighted average of Overall Scoring across every KPI that's actually been given a
  // score — unscored rows are excluded from both the numerator and denominator so a still-blank
  // KPI doesn't silently drag the total down. Falls back to the employee's own self-score until
  // the manager finalizes an Overall score, so a student who rates themselves actually sees that
  // reflected here instead of the total staying "Not yet scored".
  readonly myKpiOverallWeightedRating = computed(() => {
    const scoredEntries = this.myKpiEntries()
      .map((entry) => ({ weight: entry.weight, score: entry.overallScoring ?? entry.employeeScoring }))
      .filter((entry) => entry.score !== null && entry.weight > 0);
    const totalWeight = scoredEntries.reduce((total, entry) => total + entry.weight, 0);
    if (!totalWeight) {
      return null;
    }

    const weightedSum = scoredEntries.reduce((total, entry) => total + entry.weight * (entry.score ?? 0), 0);
    return weightedSum / totalWeight;
  });

  formatKpiOverallRating(rating: number | null): string {
    return rating === null ? 'Not yet scored' : `${rating.toFixed(1)} / 5`;
  }

  readonly kpiScoreOptions: ReadonlyArray<{ value: StudentKpiScore; label: string }> = [
    { value: 1, label: '1 - Unacceptable' },
    { value: 2, label: '2 - Not Fully Effective' },
    { value: 3, label: '3 - Fully Effective' },
    { value: 4, label: '4 - Highly Effective' },
    { value: 5, label: '5 - Outstanding' },
  ];

  kpiScoreLabel(score: StudentKpiScore | null): string {
    return this.kpiScoreOptions.find((option) => option.value === score)?.label ?? 'Not scored';
  }

  // The student stages every Employee Scoring pick locally and only sends them to the backend
  // when they click Submit — one confirmed batch write per session at the table instead of a
  // save-on-every-change network call per row, matching the same "review, then confirm" pattern
  // the manager's own KPI form already uses (see saveKpiEntries in training-manager-profile.
  // component.ts). pendingEmployeeScoring holds entryId -> staged value; an entry with no staged
  // pick yet simply isn't a key in it.
  readonly pendingEmployeeScoring = signal<Record<string, StudentKpiScore | null>>({});
  readonly hasPendingKpiChanges = computed(() => Object.keys(this.pendingEmployeeScoring()).length > 0);
  readonly kpiSubmitting = signal(false);
  readonly kpiSubmitSaved = signal(false);
  readonly kpiSubmitError = signal(false);

  resolveEmployeeScoringDisplay(entry: StudentKpiEntry): StudentKpiScore | null {
    const pending = this.pendingEmployeeScoring();
    return entry.id in pending ? pending[entry.id] : entry.employeeScoring;
  }

  isEmployeeScoringPending(entryId: string): boolean {
    return entryId in this.pendingEmployeeScoring();
  }

  stageMyKpiEmployeeScoring(entryId: string, event: Event) {
    const select = event.target as HTMLSelectElement | null;
    const raw = select?.value ?? '';
    const employeeScoring = raw ? (Number(raw) as StudentKpiScore) : null;
    this.pendingEmployeeScoring.update((current) => ({ ...current, [entryId]: employeeScoring }));
    this.kpiSubmitSaved.set(false);
    this.kpiSubmitError.set(false);
  }

  async submitMyKpiRatings() {
    const studentId = this.matchedKpiStudentId();
    const updates = Object.entries(this.pendingEmployeeScoring()).map(([id, employeeScoring]) => ({ id, employeeScoring }));
    if (!studentId || !updates.length || this.kpiSubmitting()) {
      return;
    }

    this.kpiSubmitting.set(true);
    this.kpiSubmitError.set(false);
    const success = await this.managerData.updateEmployeeKpiScoring(studentId, updates);
    this.kpiSubmitting.set(false);

    if (success) {
      this.pendingEmployeeScoring.set({});
      this.kpiSubmitSaved.set(true);
      setTimeout(() => this.kpiSubmitSaved.set(false), 3000);
    } else {
      // Keep the staged picks in place on failure — the optimistic update was already rolled
      // back by updateEmployeeKpiScoring, but the student's in-progress selections shouldn't be
      // silently discarded just because the save didn't go through; let them retry with one click.
      this.kpiSubmitError.set(true);
    }
  }

  readonly studentData = inject(StudentDataService);
  readonly managerData = inject(TrainingManagerDataService);
  readonly branding = inject(LmsBrandingService);
  private readonly backend = inject(LmsBackendService);
  readonly studentTheme = computed<LmsBrandThemeOption>(
    () => this.branding.themeOptions.find((theme) => theme.id === this.studentData.settings().themePreference) ?? this.branding.currentTheme(),
  );
  private readonly _showWelcomeBanner = signal(true);
  readonly showWelcomeBanner = computed(() => this._showWelcomeBanner());
  private readonly _welcomeBannerLeaving = signal(false);
  readonly welcomeBannerLeaving = computed(() => this._welcomeBannerLeaving());
  private readonly _messagesInitialSection = signal<'compose' | 'inbox' | null>(null);
  readonly messagesInitialSection = computed(() => this._messagesInitialSection());
  private readonly _profileMenuOpen = signal(false);
  readonly profileMenuOpen = computed(() => this._profileMenuOpen());
  private readonly _topbarDropdown = signal<'notifications' | 'messages' | null>(null);
  readonly topbarDropdown = computed(() => this._topbarDropdown());
  readonly recentNotifications = computed(() => this.studentData.notifications().filter((n) => !n.dismissed).slice(0, 4));
  readonly recentMessages = computed(() => this.studentData.messages().filter((m) => m.unread).slice(0, 3));
  readonly profileInitials = computed(() => {
    const parts = this.studentData.profile().name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S';
  });
  /** Firebase Storage URL takes priority over legacy base64 data URL. */
  readonly profileImageSrc = computed(() => {
    const profile = this.studentData.profile();
    return profile.profileImageUrl || profile.profileImageDataUrl || null;
  });
  readonly studentFirstName = computed(() => this.studentData.profile().name.trim().split(/\s+/)[0] || 'Student');
  private readonly _mentorshipProfileSaved = signal(false);
  readonly mentorshipProfileSaved = computed(() => this._mentorshipProfileSaved());
  private readonly _mentorshipObjectivesSaved = signal(false);
  readonly mentorshipObjectivesSaved = computed(() => this._mentorshipObjectivesSaved());
  private readonly _mentorshipProgressReportSaved = signal(false);
  readonly mentorshipProgressReportSaved = computed(() => this._mentorshipProgressReportSaved());
  readonly savedMentorshipProfile = computed(() => this.studentData.mentorshipProfile());
  readonly savedMentorshipObjectives = computed(() => this.studentData.mentorshipObjectives());
  readonly savedMentorshipProgressReport = computed(() => this.studentData.mentorshipProgressReport());

  readonly mentorshipProfileCompletionPct = computed(() => {
    const p = this.savedMentorshipProfile();
    const fields = [p.menteeName, p.menteeSurname, p.menteeJobTitle, p.menteeQualification, p.menteeExperience, p.mentorName, p.mentorSurname, p.mentorJobTitle, p.mentorQualification, p.mentorExperience];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  });
  readonly mentorshipGoalsDefinedCount = computed(() =>
    this.savedMentorshipObjectives().mentorshipGoals.filter((g) => g.title?.trim()).length,
  );
  readonly mentorshipRelObjectivesDefinedCount = computed(() =>
    this.savedMentorshipObjectives().objectives.filter((o) => o.title?.trim()).length,
  );
  readonly mentorshipObjectivesDefinedCount = computed(() =>
    this.mentorshipGoalsDefinedCount() + this.mentorshipRelObjectivesDefinedCount(),
  );
  readonly mentorshipObjectivesTotalCount = computed(() =>
    this.savedMentorshipObjectives().mentorshipGoals.length + this.savedMentorshipObjectives().objectives.length,
  );
  readonly mentorshipFormCompletionPct = computed(() => {
    const r = this.savedMentorshipProgressReport();
    const fields = [r.dateOfMeeting, r.mentorComments, ...r.objectivesAchieved.map((e) => e.objectiveAchieved)];
    const filled = fields.filter(Boolean).length;
    const total = Math.max(fields.length, 3);
    return Math.round((filled / total) * 100);
  });
  private readonly _activeMentorshipSection = signal<'profile' | 'objectives' | 'form'>('profile');
  private readonly _mentorshipSectionEditMode = signal(false);
  private readonly _mentorshipDialogOpen = signal(false);
  readonly mentorshipDialogOpen = computed(() => this._mentorshipDialogOpen());
  private readonly _externalTrainingRequestDialogOpen = signal(false);
  readonly externalTrainingRequestDialogOpen = computed(() => this._externalTrainingRequestDialogOpen());
  private readonly _externalTrainingStatusDialogOpen = signal(false);
  readonly externalTrainingStatusDialogOpen = computed(() => this._externalTrainingStatusDialogOpen());
  private readonly _externalTrainingRequestSubmitted = signal(false);
  readonly externalTrainingRequestSubmitted = computed(() => this._externalTrainingRequestSubmitted());
  private readonly _externalTrainingSuccessPopupVisible = signal(false);
  readonly externalTrainingSuccessPopupVisible = computed(() => this._externalTrainingSuccessPopupVisible());
  private readonly _externalTrainingSuccessPopupLeaving = signal(false);
  readonly externalTrainingSuccessPopupLeaving = computed(() => this._externalTrainingSuccessPopupLeaving());
  private readonly _externalTrainingSuccessPopupMode = signal<'create' | 'update'>('create');
  readonly externalTrainingSuccessPopupTitle = computed(() =>
    this._externalTrainingSuccessPopupMode() === 'update' ? 'Training request resubmitted' : 'Training request submitted',
  );
  readonly externalTrainingSuccessPopupCopy = computed(() =>
    this._externalTrainingSuccessPopupMode() === 'update'
      ? 'Your updated request was sent back to the manager for review.'
      : 'Your request was sent successfully for manager review.',
  );
  private readonly _editingExternalTrainingRequestId = signal<string | null>(null);
  readonly externalTrainingInvoiceFileName = signal('');
  readonly externalTrainingInvoiceDataUrl = signal('');
  readonly externalTrainingInvoiceUploading = signal(false);
  readonly externalTrainingBrochureFileName = signal('');
  readonly externalTrainingBrochureDataUrl = signal('');
  readonly externalTrainingBrochureUploading = signal(false);
  readonly externalTrainingRequestDialogTitle = computed(() =>
    this._editingExternalTrainingRequestId() ? 'Edit Training Request' : 'Request Training',
  );
  readonly externalTrainingRequestDialogDescription = computed(() =>
    this._editingExternalTrainingRequestId()
      ? 'Update the returned request and resubmit it for manager review. Required fields are marked with'
      : 'Fill in all required fields marked with',
  );
  readonly externalTrainingRequestSubmitLabel = computed(() =>
    this._editingExternalTrainingRequestId() ? 'Resubmit Training Request' : 'Submit Training Request',
  );
  readonly availableTrainingManagers = computed(() => this.managerData.trainingManagers());
  readonly learnerExternalTrainingRequests = computed(() =>
    this.managerData.externalTrainingRequests().filter((request) => request.studentEmail === this.studentData.profile().email),
  );
  readonly etPendingCount = computed(() => this.learnerExternalTrainingRequests().filter((r) => r.status === 'Pending Review').length);
  readonly etApprovedCount = computed(() => this.learnerExternalTrainingRequests().filter((r) => r.status === 'Approved').length);
  readonly etRecentRequests = computed(() =>
    [...this.learnerExternalTrainingRequests()]
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 5),
  );

  etRelativeTime(dateStr: string): string {
    if (!dateStr) return 'recently';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    const diffMonth = Math.floor(diffDay / 30);
    return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  }
  readonly selectedLearnerExternalTrainingRequestId = signal<string | null>(null);
  readonly selectedLearnerExternalTrainingRequest = computed(() => {
    const selectedId = this.selectedLearnerExternalTrainingRequestId();

    if (!selectedId) {
      return null;
    }

    return this.learnerExternalTrainingRequests().find((request) => request.id === selectedId) ?? null;
  });
  readonly mentorshipSectionEditMode = computed(() => this._mentorshipSectionEditMode());
  readonly mentorshipProfileForm = new FormGroup({
    menteeName: new FormControl(this.studentData.mentorshipProfile().menteeName, { nonNullable: true }),
    menteeSurname: new FormControl(this.studentData.mentorshipProfile().menteeSurname, { nonNullable: true }),
    menteeJobTitle: new FormControl(this.studentData.mentorshipProfile().menteeJobTitle, { nonNullable: true }),
    menteeQualification: new FormControl(this.studentData.mentorshipProfile().menteeQualification, { nonNullable: true }),
    menteeExperience: new FormControl(this.studentData.mentorshipProfile().menteeExperience, { nonNullable: true }),
    mentorName: new FormControl(this.studentData.mentorshipProfile().mentorName, { nonNullable: true }),
    mentorSurname: new FormControl(this.studentData.mentorshipProfile().mentorSurname, { nonNullable: true }),
    mentorJobTitle: new FormControl(this.studentData.mentorshipProfile().mentorJobTitle, { nonNullable: true }),
    mentorQualification: new FormControl(this.studentData.mentorshipProfile().mentorQualification, { nonNullable: true }),
    mentorExperience: new FormControl(this.studentData.mentorshipProfile().mentorExperience, { nonNullable: true }),
  });
  readonly mentorshipObjectivesForm = new FormGroup({
    mentorshipGoals: this.createObjectivesArray(this.studentData.mentorshipObjectives().mentorshipGoals),
    objectives: this.createObjectivesArray(this.studentData.mentorshipObjectives().objectives),
  });
  readonly mentorshipProgressReportForm = new FormGroup({
    dateOfMeeting: new FormControl(this.studentData.mentorshipProgressReport().dateOfMeeting, { nonNullable: true }),
    objectivesAchieved: this.createProgressEntryArray(this.studentData.mentorshipProgressReport().objectivesAchieved),
    mentorComments: new FormControl(this.studentData.mentorshipProgressReport().mentorComments, { nonNullable: true }),
  });
  readonly externalTrainingRequestForm = new FormGroup({
    courseName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    provider: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    trainingType: new FormControl<'Accredited' | 'Workshop/Seminar' | 'Informal Training' | 'Short Course'>('Accredited', { nonNullable: true, validators: [Validators.required] }),
    alignedToIdp: new FormControl<'Yes' | 'No'>('Yes', { nonNullable: true, validators: [Validators.required] }),
    trainingStartDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    trainingEndDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    courseCost: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    additionalCostRequired: new FormControl<'Yes' | 'No'>('No', { nonNullable: true, validators: [Validators.required] }),
    travelCost: new FormControl('', { nonNullable: true }),
    examCost: new FormControl('', { nonNullable: true }),
    accommodationCost: new FormControl('', { nonNullable: true }),
    approvingManagerId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly _selectedPanel = signal<'dashboard' | 'courses' | 'mentorship' | 'calendar' | 'badges' | 'performance' | 'messages' | 'external-training' | 'idp' | 'profile'>('dashboard');
  readonly selectedPanel = computed(() => this._selectedPanel());
  readonly sidePanelCollapsed = signal(false);
  readonly sidebarScrolling = signal(false);
  private sidebarScrollTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly availableSwitchRoles = signal<LoginRole[]>([]);
  readonly switchingRole = signal(false);
  private welcomeBannerExitTimer: ReturnType<typeof setTimeout> | null = null;
  private welcomeBannerHideTimer: ReturnType<typeof setTimeout> | null = null;
  private externalTrainingSuccessPopupExitTimer: ReturnType<typeof setTimeout> | null = null;
  private externalTrainingSuccessPopupHideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly router: Router) {
    effect(() => {
      const request = this.studentData.courseNavigationRequest();

      if (!request || this.selectedPanel() === 'courses') {
        return;
      }

      this.selectPanel('courses');
    });
  }

  ngOnInit() {
    this.studentData.refreshForCurrentSession();
    this.onAdditionalCostRequiredChange();
    this.startWelcomeBannerSequence();
    this.loadSwitchableRoles();
  }

  private loadSwitchableRoles() {
    this.backend.getSwitchableRoles().subscribe({
      next: (response) => this.availableSwitchRoles.set(response.roles),
      error: () => this.availableSwitchRoles.set([]),
    });
  }

  switchToRole(targetRole: LoginRole) {
    if (this.switchingRole()) {
      return;
    }

    this.switchingRole.set(true);
    this.closeProfileMenu();
    this.backend.switchRole(targetRole).subscribe({
      next: (result) => {
        localStorage.setItem('lms-session', JSON.stringify(createLmsSessionRecord({
          role: result.role,
          username: result.username,
          email: result.email,
          studentId: result.studentId ?? null,
          displayName: combineDisplayName(result.name, result.surname),
        })));
        localStorage.setItem('lms-token', result.token);
        void this.router.navigate([result.route]);
      },
      error: () => {
        this.switchingRole.set(false);
      },
    });
  }

  ngOnDestroy() {
    this.clearWelcomeBannerTimers();
    this.clearExternalTrainingSuccessPopupTimers();
    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }
  }

  /** Shows the side panel's scrollbar thumb only while actively scrolling, hiding it again
   *  shortly after — keeps the panel looking clean instead of a permanent scroll track. */
  onSidebarScroll() {
    this.sidebarScrolling.set(true);
    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }
    this.sidebarScrollTimeout = setTimeout(() => this.sidebarScrolling.set(false), 900);
  }

  private startWelcomeBannerSequence() {
    this.clearWelcomeBannerTimers();
    this._showWelcomeBanner.set(true);
    this._welcomeBannerLeaving.set(false);

    this.welcomeBannerExitTimer = setTimeout(() => {
      this._welcomeBannerLeaving.set(true);
    }, 2600);

    this.welcomeBannerHideTimer = setTimeout(() => {
      this._showWelcomeBanner.set(false);
      this._welcomeBannerLeaving.set(false);
    }, 3200);
  }

  private clearWelcomeBannerTimers() {
    if (this.welcomeBannerExitTimer) {
      clearTimeout(this.welcomeBannerExitTimer);
      this.welcomeBannerExitTimer = null;
    }

    if (this.welcomeBannerHideTimer) {
      clearTimeout(this.welcomeBannerHideTimer);
      this.welcomeBannerHideTimer = null;
    }
  }

  private startExternalTrainingSuccessPopupSequence() {
    this.clearExternalTrainingSuccessPopupTimers();
    this._externalTrainingSuccessPopupVisible.set(true);
    this._externalTrainingSuccessPopupLeaving.set(false);

    this.externalTrainingSuccessPopupExitTimer = setTimeout(() => {
      this._externalTrainingSuccessPopupLeaving.set(true);
    }, 2100);

    this.externalTrainingSuccessPopupHideTimer = setTimeout(() => {
      this._externalTrainingSuccessPopupVisible.set(false);
      this._externalTrainingSuccessPopupLeaving.set(false);
    }, 2600);
  }

  private clearExternalTrainingSuccessPopupTimers() {
    if (this.externalTrainingSuccessPopupExitTimer) {
      clearTimeout(this.externalTrainingSuccessPopupExitTimer);
      this.externalTrainingSuccessPopupExitTimer = null;
    }

    if (this.externalTrainingSuccessPopupHideTimer) {
      clearTimeout(this.externalTrainingSuccessPopupHideTimer);
      this.externalTrainingSuccessPopupHideTimer = null;
    }
  }

  navigateToPanelFromDashboard(panel: string) {
    this.selectPanel(panel as Parameters<typeof this.selectPanel>[0]);
  }

  selectPanel(panel: 'dashboard' | 'courses' | 'mentorship' | 'calendar' | 'badges' | 'performance' | 'messages' | 'external-training' | 'idp' | 'profile') {
    this._selectedPanel.set(panel);
    if (panel !== 'messages') {
      this._messagesInitialSection.set(null);
    }
    if (panel !== 'mentorship') {
      this.closeMentorshipDialog();
    }
    if (panel !== 'external-training') {
      this.closeExternalTrainingRequestDialog();
      this.closeExternalTrainingStatusDialog();
    }
    this.closeTopbarDropdown();
    this.closeProfileMenu();
  }

  toggleSidePanel() {
    this.sidePanelCollapsed.update((collapsed) => !collapsed);
  }

  toggleProfileMenu() {
    this.closeTopbarDropdown();
    this._profileMenuOpen.update((open) => !open);
  }

  closeProfileMenu() {
    this._profileMenuOpen.set(false);
  }

  openProfileMenuItem(item: 'profile' | 'dashboard') {
    this.selectPanel(item);
  }

  toggleTopbarDropdown(dropdown: 'notifications' | 'messages') {
    this.closeProfileMenu();
    const nextOpen = this.topbarDropdown() === dropdown ? null : dropdown;
    this._topbarDropdown.set(nextOpen);

    if (nextOpen === 'notifications') {
      this.studentData.markNotificationsRead();
    }
  }

  closeTopbarDropdown() {
    this._topbarDropdown.set(null);
  }

  openNotificationsPanel() {
    this.closeTopbarDropdown();
    this.selectPanel('dashboard');
    this.studentData.markNotificationsRead();
  }

  handleNotificationClick(notification: { id: string }) {
    this.studentData.dismissNotification(notification.id);
    this.closeTopbarDropdown();
    if (notification.id.startsWith('course-')) {
      this.selectPanel('courses');
    }
  }

  openMessagesPanel() {
    this._messagesInitialSection.set('inbox');
    this.closeTopbarDropdown();
    this.selectPanel('messages');
    this.studentData.markMessagesRead();
  }

  isMentorshipSectionOpen(section: 'profile' | 'objectives' | 'form') {
    return this.mentorshipDialogOpen() && this._activeMentorshipSection() === section;
  }

  selectMentorshipSection(section: 'profile' | 'objectives' | 'form') {
    this.syncMentorshipSectionForm(section);
    this._activeMentorshipSection.set(section);
    this._mentorshipSectionEditMode.set(!this.mentorshipSectionSaved(section));
    this._mentorshipDialogOpen.set(true);
  }

  closeMentorshipDialog() {
    this._mentorshipSectionEditMode.set(false);
    this._mentorshipDialogOpen.set(false);
  }

  openExternalTrainingRequestDialog() {
    this.resetExternalTrainingRequestDraft();
    this._externalTrainingRequestDialogOpen.set(true);
  }

  closeExternalTrainingRequestDialog() {
    this._externalTrainingRequestDialogOpen.set(false);
    this.resetExternalTrainingRequestDraft();
  }

  openExternalTrainingStatusDialog() {
    this.selectedLearnerExternalTrainingRequestId.set(null);
    this._externalTrainingStatusDialogOpen.set(true);
  }

  closeExternalTrainingStatusDialog() {
    this.selectedLearnerExternalTrainingRequestId.set(null);
    this._externalTrainingStatusDialogOpen.set(false);
  }

  openExternalTrainingRequestDetail(requestId: string) {
    this.selectedLearnerExternalTrainingRequestId.set(requestId);
  }

  closeExternalTrainingRequestDetail() {
    this.selectedLearnerExternalTrainingRequestId.set(null);
  }

  editExternalTrainingRequest(request: ExternalTrainingRequestRecord) {
    if (request.status !== 'Needs Revision') {
      return;
    }

    this.closeExternalTrainingStatusDialog();
    this.loadExternalTrainingRequestDraft(request);
    this._externalTrainingRequestDialogOpen.set(true);
  }

  onAdditionalCostRequiredChange() {
    const additionalCostRequired = this.externalTrainingRequestForm.controls.additionalCostRequired.value;
    const extraCostControls = [
      this.externalTrainingRequestForm.controls.travelCost,
      this.externalTrainingRequestForm.controls.examCost,
      this.externalTrainingRequestForm.controls.accommodationCost,
    ];

    for (const control of extraCostControls) {
      control.clearValidators();
    }

    if (additionalCostRequired === 'Yes') {
      for (const control of extraCostControls) {
        control.addValidators(Validators.required);
        control.updateValueAndValidity();
      }
      return;
    }

    this.externalTrainingRequestForm.patchValue({
      travelCost: '',
      examCost: '',
      accommodationCost: '',
    }, { emitEvent: false });

    for (const control of extraCostControls) {
      control.updateValueAndValidity();
    }
  }

  // Uploaded to storage (via the same chunked relay used for course content) rather than
  // embedded as a base64 data URL directly in the request record: Firestore rejects any single
  // field over ~1 MB, and a base64-encoded scanned invoice/brochure crosses that easily — which
  // used to fail the whole submission with an opaque 500 and no attachment ever saved.
  onExternalTrainingInvoiceSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (input) {
      input.value = '';
    }

    if (!file) {
      this.externalTrainingInvoiceFileName.set('');
      this.externalTrainingInvoiceDataUrl.set('');
      return;
    }

    this.externalTrainingInvoiceUploading.set(true);
    this.backend.uploadFileChunked(file, 'external-training-attachments').subscribe({
      next: (uploadEvent) => {
        if (uploadEvent.type !== 'complete') {
          return;
        }
        this.externalTrainingInvoiceUploading.set(false);
        this.externalTrainingInvoiceFileName.set(file.name);
        this.externalTrainingInvoiceDataUrl.set(uploadEvent.url);
      },
      error: () => {
        this.externalTrainingInvoiceUploading.set(false);
        this.externalTrainingInvoiceFileName.set('');
        this.externalTrainingInvoiceDataUrl.set('');
        alert(`Failed to upload "${file.name}". Please check your connection and try again.`);
      },
    });
  }

  onExternalTrainingBrochureSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (input) {
      input.value = '';
    }

    if (!file) {
      this.externalTrainingBrochureFileName.set('');
      this.externalTrainingBrochureDataUrl.set('');
      return;
    }

    this.externalTrainingBrochureUploading.set(true);
    this.backend.uploadFileChunked(file, 'external-training-attachments').subscribe({
      next: (uploadEvent) => {
        if (uploadEvent.type !== 'complete') {
          return;
        }
        this.externalTrainingBrochureUploading.set(false);
        this.externalTrainingBrochureFileName.set(file.name);
        this.externalTrainingBrochureDataUrl.set(uploadEvent.url);
      },
      error: () => {
        this.externalTrainingBrochureUploading.set(false);
        this.externalTrainingBrochureFileName.set('');
        this.externalTrainingBrochureDataUrl.set('');
        alert(`Failed to upload "${file.name}". Please check your connection and try again.`);
      },
    });
  }

  submitExternalTrainingRequest() {
    if (this.externalTrainingRequestForm.invalid) {
      this.externalTrainingRequestForm.markAllAsTouched();
      return;
    }

    const formValue = this.externalTrainingRequestForm.getRawValue();
    const requestPayload = {
      studentId: this.currentStudentRecord()?.id ?? '',
      studentName: this.studentData.profile().name,
      studentEmail: this.studentData.profile().email,
      courseName: formValue.courseName,
      provider: formValue.provider,
      trainingType: formValue.trainingType,
      alignedToIdp: formValue.alignedToIdp,
      trainingStartDate: formValue.trainingStartDate,
      trainingEndDate: formValue.trainingEndDate,
      courseCost: formValue.courseCost,
      additionalCostRequired: formValue.additionalCostRequired,
      travelCost: formValue.travelCost,
      examCost: formValue.examCost,
      accommodationCost: formValue.accommodationCost,
      approvingManagerId: formValue.approvingManagerId,
      invoiceFileName: this.externalTrainingInvoiceFileName(),
      invoiceDataUrl: this.externalTrainingInvoiceDataUrl(),
      brochureFileName: this.externalTrainingBrochureFileName(),
      brochureDataUrl: this.externalTrainingBrochureDataUrl(),
    };
    const editingRequestId = this._editingExternalTrainingRequestId();

    if (editingRequestId) {
      this.managerData.updateExternalTrainingRequest({
        requestId: editingRequestId,
        ...requestPayload,
      });
      this._externalTrainingSuccessPopupMode.set('update');
    } else {
      this.managerData.submitExternalTrainingRequest(requestPayload);
      this._externalTrainingSuccessPopupMode.set('create');
    }

    this._externalTrainingRequestSubmitted.set(true);
    this._externalTrainingRequestDialogOpen.set(false);
    this.resetExternalTrainingRequestDraft();
    this.startExternalTrainingSuccessPopupSequence();
  }

  openExternalTrainingSupportingDocument(dataUrl: string) {
    if (!dataUrl) {
      return;
    }

    // New attachments are real Storage URLs — just open them directly. Only requests submitted
    // before the invoice/brochure upload moved off inline base64 still carry a literal data: URL.
    if (!dataUrl.startsWith('data:')) {
      globalThis.open?.(dataUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const objectUrl = URL.createObjectURL(this.dataUrlToBlob(dataUrl));
    const popup = globalThis.open?.(objectUrl, '_blank', 'noopener,noreferrer');

    if (!popup) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';

      document.body.append(link);
      link.click();
      link.remove();
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }

  private dataUrlToBlob(dataUrl: string) {
    const [metadata, base64Payload = ''] = dataUrl.split(',', 2);
    const mimeType = metadata.match(/^data:([^;]+)/i)?.[1] || 'application/octet-stream';
    const binary = atob(base64Payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  }

  private loadExternalTrainingRequestDraft(request: ExternalTrainingRequestRecord) {
    this._externalTrainingRequestSubmitted.set(false);
    this._editingExternalTrainingRequestId.set(request.id);
    this.externalTrainingRequestForm.reset({
      courseName: request.courseName,
      provider: request.provider,
      trainingType: request.trainingType,
      alignedToIdp: request.alignedToIdp,
      trainingStartDate: request.trainingStartDate,
      trainingEndDate: request.trainingEndDate,
      courseCost: request.courseCost,
      additionalCostRequired: request.additionalCostRequired,
      travelCost: request.travelCost,
      examCost: request.examCost,
      accommodationCost: request.accommodationCost,
      approvingManagerId: request.approvingManagerId,
    });
    this.onAdditionalCostRequiredChange();
    this.externalTrainingInvoiceFileName.set(request.invoiceFileName);
    this.externalTrainingInvoiceDataUrl.set(request.invoiceDataUrl);
    this.externalTrainingInvoiceUploading.set(false);
    this.externalTrainingBrochureFileName.set(request.brochureFileName);
    this.externalTrainingBrochureDataUrl.set(request.brochureDataUrl);
    this.externalTrainingBrochureUploading.set(false);
  }

  private resetExternalTrainingRequestDraft() {
    this._externalTrainingRequestSubmitted.set(false);
    this._editingExternalTrainingRequestId.set(null);
    this.externalTrainingRequestForm.reset({
      courseName: '',
      provider: '',
      trainingType: 'Accredited',
      alignedToIdp: 'Yes',
      trainingStartDate: '',
      trainingEndDate: '',
      courseCost: '',
      additionalCostRequired: 'No',
      travelCost: '',
      examCost: '',
      accommodationCost: '',
      approvingManagerId: '',
    });
    this.onAdditionalCostRequiredChange();
    this.externalTrainingInvoiceFileName.set('');
    this.externalTrainingInvoiceDataUrl.set('');
    this.externalTrainingInvoiceUploading.set(false);
    this.externalTrainingBrochureFileName.set('');
    this.externalTrainingBrochureDataUrl.set('');
    this.externalTrainingBrochureUploading.set(false);
  }

  openMentorshipSectionEdit() {
    this.syncMentorshipSectionForm(this._activeMentorshipSection());
    this._mentorshipSectionEditMode.set(true);
  }

  cancelMentorshipSectionEdit() {
    this.syncMentorshipSectionForm(this._activeMentorshipSection());
    this._mentorshipSectionEditMode.set(false);
  }

  mentorshipGoalsControls() {
    return this.mentorshipObjectivesForm.controls.mentorshipGoals.controls;
  }

  relationshipObjectivesControls() {
    return this.mentorshipObjectivesForm.controls.objectives.controls;
  }

  addMentorshipGoal() {
    this.mentorshipObjectivesForm.controls.mentorshipGoals.push(this.createObjectiveGroup());
  }

  removeMentorshipGoal(index: number) {
    if (this.mentorshipObjectivesForm.controls.mentorshipGoals.length === 1) {
      return;
    }

    this.mentorshipObjectivesForm.controls.mentorshipGoals.removeAt(index);
  }

  addRelationshipObjective() {
    this.mentorshipObjectivesForm.controls.objectives.push(this.createObjectiveGroup());
  }

  removeRelationshipObjective(index: number) {
    if (this.mentorshipObjectivesForm.controls.objectives.length === 1) {
      return;
    }

    this.mentorshipObjectivesForm.controls.objectives.removeAt(index);
  }

  progressEntryControls() {
    return this.mentorshipProgressReportForm.controls.objectivesAchieved.controls;
  }

  addProgressEntry() {
    this.mentorshipProgressReportForm.controls.objectivesAchieved.push(this.createProgressEntryGroup());
  }

  removeProgressEntry(index: number) {
    if (this.mentorshipProgressReportForm.controls.objectivesAchieved.length === 1) {
      return;
    }

    this.mentorshipProgressReportForm.controls.objectivesAchieved.removeAt(index);
  }

  async saveMentorshipProfile() {
    const profile = this.mentorshipProfileForm.getRawValue() as StudentMentorshipProfile;

    const saved = await this.studentData.updateMentorshipProfile(profile);
    if (!saved) {
      alert('Your mentorship profile could not be saved. Please check your connection and try again.');
      return;
    }

    this.submitMentorshipFormSubmission({
      formId: 'profile',
      formTitle: 'Mentorship Profile Form',
      mentorName: [profile.mentorName, profile.mentorSurname].filter(Boolean).join(' '),
      actionPlan: this.buildMentorshipProfileSubmissionSummary(profile),
      profileData: {
        jobTitle: profile.menteeJobTitle,
        mentorName: profile.mentorName,
        mentorSurname: profile.mentorSurname,
      },
    });
    this._mentorshipProfileSaved.set(true);
    this._mentorshipSectionEditMode.set(false);
  }

  async saveMentorshipObjectives() {
    const objectives = this.mentorshipObjectivesForm.getRawValue() as StudentMentorshipObjectives;

    const saved = await this.studentData.updateMentorshipObjectives(objectives);
    if (!saved) {
      alert('Your mentorship goals and objectives could not be saved. Please check your connection and try again.');
      return;
    }

    this.submitMentorshipFormSubmission({
      formId: 'objectives',
      formTitle: 'Mentorship Objectives Form',
      actionPlan: this.buildMentorshipObjectivesSubmissionSummary(objectives),
    });
    this._mentorshipObjectivesSaved.set(true);
    this._mentorshipSectionEditMode.set(false);
  }

  async saveMentorshipProgressReport() {
    const report = this.mentorshipProgressReportForm.getRawValue() as StudentMentorshipProgressReport;

    const saved = await this.studentData.updateMentorshipProgressReport(report);
    if (!saved) {
      alert('Your mentorship progress report could not be saved. Please check your connection and try again.');
      return;
    }

    this.submitMentorshipFormSubmission({
      formId: 'progress-report',
      formTitle: 'Mentorship Progress Report',
      actionPlan: this.buildMentorshipProgressReportSubmissionSummary(report),
      sessionDate: this.formatMentorshipSubmissionDate(report.dateOfMeeting),
    });
    this._mentorshipProgressReportSaved.set(true);
    this._mentorshipSectionEditMode.set(false);
  }

  mentorFullName() {
    return [this.savedMentorshipProfile().mentorName, this.savedMentorshipProfile().mentorSurname].filter(Boolean).join(' ');
  }

  private submitMentorshipFormSubmission(input: {
    formId: 'profile' | 'objectives' | 'progress-report';
    formTitle: string;
    actionPlan: string;
    mentorName?: string;
    sessionDate?: string;
    profileData?: { jobTitle: string; mentorName: string; mentorSurname: string };
  }) {
    const currentStudent = this.currentStudentRecord();
    const studentId = currentStudent?.id ?? '';
    const studentName = currentStudent ? `${currentStudent.name} ${currentStudent.surname}` : this.studentData.profile().name.trim();
    const studentEmail = currentStudent?.email ?? this.studentData.profile().email.trim();
    const mentorName = input.mentorName?.trim() || this.currentMentorFullName();

    if (!studentId || !studentName || !studentEmail || !mentorName || !input.actionPlan.trim()) {
      return;
    }

    this.managerData.submitMentorshipFormSubmission({
      studentId,
      studentName,
      studentEmail,
      mentorName,
      formId: input.formId,
      formTitle: input.formTitle,
      actionPlan: input.actionPlan,
      sessionDate: input.sessionDate,
      profileData: input.profileData,
    });
  }

  private currentStudentRecord() {
    const currentStudentEmail = this.studentData.profile().email.trim().toLocaleLowerCase();
    return this.managerData.students().find((student) => student.email.trim().toLocaleLowerCase() === currentStudentEmail) ?? null;
  }

  private currentMentorFullName() {
    const mentorshipAssignment = this.currentStudentMentorshipAssignment();
    const assignedMentorName = mentorshipAssignment
      ? [mentorshipAssignment.mentorName, mentorshipAssignment.mentorSurname].filter(Boolean).join(' ').trim()
      : '';

    if (assignedMentorName) {
      return assignedMentorName;
    }

    return [this.savedMentorshipProfile().mentorName, this.savedMentorshipProfile().mentorSurname].filter(Boolean).join(' ').trim();
  }

  private currentStudentMentorshipAssignment() {
    const currentStudent = this.currentStudentRecord();

    if (!currentStudent) {
      return null;
    }

    return this.managerData.mentorshipAssignments().find((assignment) => assignment.menteeId === currentStudent.id) ?? null;
  }

  private buildMentorshipProfileSubmissionSummary(profile: StudentMentorshipProfile) {
    return [
      `Mentee: ${[profile.menteeName, profile.menteeSurname].filter(Boolean).join(' ')}`,
      `Mentee job title: ${profile.menteeJobTitle}`,
      `Mentee qualification: ${profile.menteeQualification}`,
      `Mentee experience: ${profile.menteeExperience}`,
      `Mentor: ${[profile.mentorName, profile.mentorSurname].filter(Boolean).join(' ')}`,
      `Mentor job title: ${profile.mentorJobTitle}`,
      `Mentor qualification: ${profile.mentorQualification}`,
      `Mentor experience: ${profile.mentorExperience}`,
    ].join('\n');
  }

  private buildMentorshipObjectivesSubmissionSummary(objectives: StudentMentorshipObjectives) {
    const mentorshipGoals = this.describeMentorshipObjectives(objectives.mentorshipGoals, 'Mentorship goals');
    const recordedObjectives = this.describeMentorshipObjectives(objectives.objectives, 'Objectives');

    return [mentorshipGoals, recordedObjectives].filter(Boolean).join('\n\n');
  }

  private buildMentorshipProgressReportSubmissionSummary(report: StudentMentorshipProgressReport) {
    const achievedObjectives = report.objectivesAchieved
      .filter((entry) => entry.objectiveAchieved.trim() || entry.dateAchieved.trim())
      .map((entry, index) => {
        const dateAchieved = entry.dateAchieved.trim();
        const dateLabel = dateAchieved ? ` (${this.formatMentorshipSubmissionDate(dateAchieved)})` : '';
        return `${index + 1}. ${entry.objectiveAchieved.trim() || 'Objective recorded'}${dateLabel}`;
      });

    return [
      `Meeting date: ${this.formatMentorshipSubmissionDate(report.dateOfMeeting)}`,
      achievedObjectives.length ? `Objectives achieved:\n${achievedObjectives.join('\n')}` : 'Objectives achieved: None recorded',
      `Mentor comments: ${report.mentorComments.trim()}`,
    ].join('\n\n');
  }

  private describeMentorshipObjectives(entries: StudentMentorshipObjectiveEntry[], heading: string) {
    const rows = entries
      .filter((entry) => entry.title.trim() || entry.date.trim() || entry.achievementDate.trim())
      .map((entry, index) => {
        const targetDate = entry.date.trim() ? this.formatMentorshipSubmissionDate(entry.date) : 'No target date';
        const achievementDate = entry.achievementDate.trim()
          ? this.formatMentorshipSubmissionDate(entry.achievementDate)
          : 'Not yet achieved';
        return `${index + 1}. ${entry.title.trim() || 'Untitled item'} | Target: ${targetDate} | Achieved: ${achievementDate}`;
      });

    return rows.length ? `${heading}:\n${rows.join('\n')}` : '';
  }

  private formatMentorshipSubmissionDate(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return '';
    }

    const parsedDate = new Date(`${trimmedValue}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return trimmedValue;
    }

    return new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsedDate);
  }

  mentorshipSectionSaved(section: 'profile' | 'objectives' | 'form') {
    switch (section) {
      case 'profile':
        return this.hasSavedMentorshipProfile();
      case 'objectives':
        return this.hasSavedMentorshipObjectives();
      case 'form':
        return this.hasSavedMentorshipProgressReport();
    }
  }

  mentorshipSectionStatus(section: 'profile' | 'objectives' | 'form') {
    return this.mentorshipSectionSaved(section) ? 'Saved form' : 'New form';
  }

  mentorshipSectionSummary(section: 'profile' | 'objectives' | 'form') {
    switch (section) {
      case 'profile': {
        const profile = this.savedMentorshipProfile();
        if (!this.hasSavedMentorshipProfile()) {
          return 'Complete your mentorship profile with both mentee and mentor details.';
        }

        const mentorName = [profile.mentorName, profile.mentorSurname].filter(Boolean).join(' ');
        return mentorName
          ? `Saved form. Mentor linked: ${mentorName}. Open to review or edit the saved profile.`
          : 'Saved form. Open to review or edit the saved mentorship profile.';
      }
      case 'objectives': {
        const objectives = this.savedMentorshipObjectives();
        const goalCount = objectives.mentorshipGoals.length;
        const objectiveCount = objectives.objectives.length;

        if (!this.hasSavedMentorshipObjectives()) {
          return 'Use this section for mentorship goals, targets, and planned outcomes.';
        }

        return `Saved form. ${goalCount} goal${goalCount === 1 ? '' : 's'} and ${objectiveCount} objective${objectiveCount === 1 ? '' : 's'} recorded. Open to edit the saved items.`;
      }
      case 'form': {
        const report = this.savedMentorshipProgressReport();
        const achievedCount = report.objectivesAchieved.length;

        if (!this.hasSavedMentorshipProgressReport()) {
          return 'Save the mentee and mentor progress report here, then return later to update the saved form.';
        }

        return report.dateOfMeeting
          ? `Saved form from ${report.dateOfMeeting}. ${achievedCount} achieved objective${achievedCount === 1 ? '' : 's'} recorded. Open to edit the saved report.`
          : `Saved form. ${achievedCount} achieved objective${achievedCount === 1 ? '' : 's'} recorded. Open to edit the saved report.`;
      }
    }
  }

  private hasSavedMentorshipProfile() {
    const profile = this.savedMentorshipProfile();
    return [
      profile.menteeJobTitle,
      profile.menteeQualification,
      profile.menteeExperience,
      profile.mentorName,
      profile.mentorSurname,
      profile.mentorJobTitle,
      profile.mentorQualification,
      profile.mentorExperience,
    ].some((value) => value.trim().length > 0);
  }

  private hasSavedMentorshipObjectives() {
    const objectives = this.savedMentorshipObjectives();
    return objectives.mentorshipGoals.some((goal) => Boolean(goal.title || goal.date || goal.achievementDate))
      || objectives.objectives.some((objective) => Boolean(objective.title || objective.date || objective.achievementDate));
  }

  private hasSavedMentorshipProgressReport() {
    const report = this.savedMentorshipProgressReport();
    return Boolean(report.dateOfMeeting || report.mentorComments.trim())
      || report.objectivesAchieved.some((entry) => Boolean(entry.objectiveAchieved || entry.dateAchieved));
  }

  private syncMentorshipSectionForm(section: 'profile' | 'objectives' | 'form') {
    switch (section) {
      case 'profile': {
        const profile = this.savedMentorshipProfile();
        const assignment = this.currentStudentMentorshipAssignment();
        const ownProfile = this.studentData.profile();
        this.mentorshipProfileForm.reset({
          ...profile,
          menteeName: profile.menteeName || assignment?.menteeName || '',
          menteeSurname: profile.menteeSurname || assignment?.menteeSurname || '',
          menteeJobTitle: profile.menteeJobTitle || assignment?.jobTitle || ownProfile.jobTitle || '',
          mentorName: profile.mentorName || assignment?.mentorName || '',
          mentorSurname: profile.mentorSurname || assignment?.mentorSurname || '',
        });
        return;
      }
      case 'objectives': {
        const objectives = this.savedMentorshipObjectives();
        this.replaceObjectivesArray(this.mentorshipObjectivesForm.controls.mentorshipGoals, objectives.mentorshipGoals);
        this.replaceObjectivesArray(this.mentorshipObjectivesForm.controls.objectives, objectives.objectives);
        return;
      }
      case 'form': {
        const report = this.savedMentorshipProgressReport();
        this.mentorshipProgressReportForm.controls.dateOfMeeting.reset(report.dateOfMeeting);
        this.mentorshipProgressReportForm.controls.mentorComments.reset(report.mentorComments);
        this.replaceProgressEntryArray(this.mentorshipProgressReportForm.controls.objectivesAchieved, report.objectivesAchieved);
        return;
      }
    }
  }

  private replaceObjectivesArray(target: FormArray<FormGroup<{ title: FormControl<string>; date: FormControl<string>; achievementDate: FormControl<string>; }>>, values: StudentMentorshipObjectiveEntry[]) {
    target.clear();
    const nextValues = values.length ? values : [{ title: '', date: '', achievementDate: '' }];
    nextValues.forEach((value) => target.push(this.createObjectiveGroup(value)));
  }

  private replaceProgressEntryArray(target: FormArray<FormGroup<{ objectiveAchieved: FormControl<string>; dateAchieved: FormControl<string>; }>>, values: StudentMentorshipProgressEntry[]) {
    target.clear();
    const nextValues = values.length ? values : [{ objectiveAchieved: '', dateAchieved: '' }];
    nextValues.forEach((value) => target.push(this.createProgressEntryGroup(value)));
  }

  private createObjectivesArray(values: StudentMentorshipObjectiveEntry[]) {
    const entries = values.length ? values : [{ title: '', date: '', achievementDate: '' }];
    return new FormArray(entries.map((value) => this.createObjectiveGroup(value)));
  }

  private createProgressEntryArray(entries: StudentMentorshipProgressEntry[]) {
    const values = entries.length ? entries : [{ objectiveAchieved: '', dateAchieved: '' }];
    return new FormArray(values.map((entry) => this.createProgressEntryGroup(entry)));
  }

  private createObjectiveGroup(entry?: StudentMentorshipObjectiveEntry) {
    return new FormGroup({
      title: new FormControl(entry?.title ?? '', { nonNullable: true }),
      date: new FormControl(entry?.date ?? '', { nonNullable: true }),
      achievementDate: new FormControl(entry?.achievementDate ?? '', { nonNullable: true }),
    });
  }

  private createProgressEntryGroup(entry?: StudentMentorshipProgressEntry) {
    return new FormGroup({
      objectiveAchieved: new FormControl(entry?.objectiveAchieved ?? '', { nonNullable: true }),
      dateAchieved: new FormControl(entry?.dateAchieved ?? '', { nonNullable: true }),
    });
  }

  logout() {
    if (window.confirm('Are you sure you want to log out?')) {
      clearLmsAuthSession();
      this.router.navigate(['/']);
    }
  }
}
