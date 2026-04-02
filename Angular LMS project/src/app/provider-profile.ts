import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  templateUrl: './provider-profile.html',
  styleUrl: './provider-profile.css',
})
export class ProviderProfile {
  readonly provider = signal({
    name: 'Acme Training Solutions',
    contact: 'info@acmetraining.com',
    courses: [
      'Advanced Web Development',
      'Data Science Bootcamp',
      'Project Management Essentials',
    ],
  });
}
