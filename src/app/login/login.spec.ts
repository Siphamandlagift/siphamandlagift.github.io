import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Login } from './login';
import { LmsBackendService } from '../lms-backend.service';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let router: Router;
  let backend: {
    login: ReturnType<typeof vi.fn>;
    requestPasswordReset: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    backend = {
      login: vi.fn(),
      requestPasswordReset: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: LmsBackendService, useValue: backend },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens forgot password dialog with current role and username', () => {
    component.selectedRole = 'student';

    component.openForgotPassword(new Event('click'));

    expect(component.activeDialog).toBe('forgot-password');
    expect(component.forgotPasswordEmail).toBe('');
  });

  it('requests a password reset email when an address is entered', () => {
    backend.requestPasswordReset.mockReturnValue(of({ message: 'Reset link sent.' }));
    component.openForgotPassword(new Event('click'));
    component.forgotPasswordEmail = 'alice.johnson@skillsconnect.app';

    component.submitForgotPassword();

    expect(component.forgotPasswordSubmitted).toBe(true);
    expect(component.forgotPasswordError).toBe('');
    expect(component.forgotPasswordMessage).toContain('Reset link sent');
  });

  it('shows an error when the reset request fails', () => {
    backend.requestPasswordReset.mockReturnValue(throwError(() => ({ error: { message: 'SMTP is not configured.' } })));
    component.openForgotPassword(new Event('click'));
    component.forgotPasswordEmail = 'alice.johnson@skillsconnect.app';

    component.submitForgotPassword();

    expect(component.forgotPasswordSubmitted).toBe(false);
    expect(component.forgotPasswordError).toContain('SMTP is not configured');
  });

  it('opens contact admin dialog', () => {
    component.openContactAdmin(new Event('click'));

    expect(component.activeDialog).toBe('contact-admin');
  });

  it('signs in with backend authentication', () => {
    backend.login.mockReturnValue(of({
      role: 'student',
      route: '/student-profile',
      username: 'student',
      email: 'alice.johnson@skillsconnect.app',
    }));
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.selectedRole = 'student';
    component.username = 'student';
    component.password = 'student';
    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/student-profile']);
  });

  it('shows an invalid login message when authentication is rejected', () => {
    backend.login.mockReturnValue(throwError(() => ({ status: 401 })));

    component.selectedRole = 'student';
    component.username = 'student';
    component.password = 'wrong';
    component.onSubmit();

    expect(component.errorMessage).toContain('Invalid student login');
  });
});
