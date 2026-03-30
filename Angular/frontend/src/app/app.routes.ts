import { Routes } from '@angular/router';

import { authRoutes } from './auth/auth.routes';
import { usersRoutes } from './users/users.routes';
import { companiesRoutes } from './companies/companies.routes';
import { coursesRoutes } from './courses/courses.routes';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
	{ path: 'auth', children: authRoutes },
	{ path: 'users', canActivate: [authGuard(['Admin'])], children: usersRoutes },
	{ path: 'companies', canActivate: [authGuard(['Admin', 'TrainingManager'])], children: companiesRoutes },
	{ path: 'courses', canActivate: [authGuard(['Admin', 'TrainingManager', 'Student'])], children: coursesRoutes },
	{ path: 'assessments', component: (await import('./assessments/assessments.component')).AssessmentsComponent },
	{ path: 'assignments', component: (await import('./assignments/assignments.component')).AssignmentsComponent },
	{ path: 'submissions', component: (await import('./submissions/submissions.component')).SubmissionsComponent },
	{ path: 'grading', component: (await import('./grading/grading.component')).GradingComponent },
	{ path: 'certificates', component: (await import('./certificates/certificates.component')).CertificatesComponent },
	{ path: 'gamification', component: (await import('./gamification/gamification.component')).GamificationComponent },
	{ path: 'progress', component: (await import('./progress/progress.component')).ProgressComponent },
	{ path: 'enrollment', component: (await import('./enrollment/enrollment.component')).EnrollmentComponent },
	{ path: 'notifications', component: (await import('./notifications/notifications.component')).NotificationsComponent },
	{ path: 'file-management', component: (await import('./file-management/file-management.component')).FileManagementComponent },
	{ path: 'ui-ux', component: (await import('./ui-ux/ui-ux.component')).UiUxComponent },
	{ path: 'mobile', component: (await import('./mobile/mobile.component')).MobileComponent },
	{ path: 'workflow', component: (await import('./workflow/workflow.component')).WorkflowComponent },
	{ path: '', redirectTo: '/auth/login', pathMatch: 'full' },
];
