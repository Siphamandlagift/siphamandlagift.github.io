import { Component } from '@angular/core';
import { UserService } from '../users/user.service';
import { CourseService } from '../courses/course.service';
import { ProgressService } from '../courses/progress.service';

@Component({
  selector: 'app-reporting',
  standalone: true,
  template: `
    <h2>Reporting & Analytics</h2>
    <div style="margin-bottom:2rem;">
      <h3>User Progress</h3>
      <table border="1" cellpadding="4" style="width:100%; max-width:900px;">
        <tr><th>User</th><th>Course</th><th>Progress (%)</th></tr>
        <tr *ngFor="let row of userProgress">
          <td>{{ row.username }}</td>
          <td>{{ row.courseName }}</td>
          <td>{{ row.progress }}</td>
        </tr>
      </table>
    </div>
    <div>
      <h3>Course Completion Stats</h3>
      <table border="1" cellpadding="4" style="width:100%; max-width:900px;">
        <tr><th>Course</th><th>Users Completed</th><th>Total Users</th></tr>
        <tr *ngFor="let stat of courseStats">
          <td>{{ stat.courseName }}</td>
          <td>{{ stat.completed }}</td>
          <td>{{ stat.total }}</td>
        </tr>
      </table>
    </div>
  `,
  providers: [UserService, CourseService, ProgressService],
})
export class ReportingComponent {
  userProgress: { username: string; courseName: string; progress: number }[] = [];
  courseStats: { courseName: string; completed: number; total: number }[] = [];

  constructor(
    public userService: UserService,
    public courseService: CourseService,
    public progressService: ProgressService
  ) {
    const users = this.userService.users();
    const courses = this.courseService.courses();
    const progress = this.progressService.progress();
    // User progress table
    this.userProgress = progress.map(p => {
      const user = users.find(u => u.id === p.userId);
      const course = courses.find(c => c.id === p.courseId);
      return {
        username: user?.username || 'Unknown',
        courseName: course?.name || 'Unknown',
        progress: p.progress
      };
    });
    // Course completion stats
    this.courseStats = courses.map(course => {
      const total = users.length;
      const completed = progress.filter(p => p.courseId === course.id && p.progress === 100).length;
      return {
        courseName: course.name,
        completed,
        total
      };
    });
  }
}
