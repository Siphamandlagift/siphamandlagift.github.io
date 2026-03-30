import { Routes } from '@angular/router';
import { CourseListComponent } from './course-list/course-list.component';
import { CourseEditComponent } from './course-edit/course-edit.component';

export const coursesRoutes: Routes = [
  { path: '', component: CourseListComponent },
  { path: 'edit/:id', component: CourseEditComponent },
];
