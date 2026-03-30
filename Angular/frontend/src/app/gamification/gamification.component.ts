import { Component } from '@angular/core';
import { GamificationService, Badge, UserBadge } from './gamification.service';

@Component({
  selector: 'app-gamification',
  standalone: true,
  template: `
    <h2>Gamification</h2>
    <div style="margin-bottom:2rem;">
      <h3>Your Badges</h3>
      <div *ngIf="userBadges.length; else noBadges">
        <span *ngFor="let ub of userBadges">
          <span style="font-size:2rem; margin-right:1rem;">
            {{ getBadge(ub.badgeId)?.icon }}
            <span style="font-size:1rem;">{{ getBadge(ub.badgeId)?.name }}</span>
          </span>
        </span>
      </div>
      <ng-template #noBadges><span>No badges yet.</span></ng-template>
    </div>
    <div style="margin-bottom:2rem;">
      <h3>Your Points</h3>
      <span style="font-size:1.5rem;">{{ points }}</span>
    </div>
    <div>
      <h3>Leaderboard</h3>
      <table border="1" cellpadding="4" style="width:100%; max-width:500px;">
        <tr><th>Rank</th><th>User ID</th><th>Points</th></tr>
        <tr *ngFor="let entry of leaderboard; let i = index">
          <td>{{ i + 1 }}</td>
          <td>{{ entry.userId }}</td>
          <td>{{ entry.points }}</td>
        </tr>
      </table>
    </div>
    <div style="margin-top:2rem;">
      <h3>All Badges</h3>
      <ul>
        <li *ngFor="let badge of badges">
          <span style="font-size:2rem;">{{ badge.icon }}</span>
          <b>{{ badge.name }}</b>: {{ badge.description }}
        </li>
      </ul>
    </div>
  `,
  providers: [GamificationService],
})
export class GamificationComponent {
  currentUserId = 1; // Simulate logged-in user
  badges: Badge[] = [];
  userBadges: UserBadge[] = [];
  points = 0;
  leaderboard: { userId: number; points: number }[] = [];

  constructor(public gamificationService: GamificationService) {
    this.badges = this.gamificationService.getBadges();
    this.userBadges = this.gamificationService.getUserBadges(this.currentUserId);
    this.points = this.gamificationService.getPoints(this.currentUserId);
    this.leaderboard = this.gamificationService.getLeaderboard();
  }

  getBadge(badgeId: number) {
    return this.badges.find(b => b.id === badgeId);
  }
}