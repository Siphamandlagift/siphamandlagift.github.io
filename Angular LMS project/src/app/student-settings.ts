import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-student-settings',
  standalone: true,
  templateUrl: './student-settings.html',
  styleUrl: './student-settings.css',
})
export class StudentSettings {
  readonly settings = signal({
    notifications: true,
    darkMode: false,
  });

  toggleSetting(key: 'notifications' | 'darkMode') {
    this.settings.update(s => ({ ...s, [key]: !s[key] }));
  }
}
