import { Injectable } from '@angular/core';

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export interface UserBadge {
  userId: number;
  badgeId: number;
  awardedAt: string;
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private badges: Badge[] = [
    { id: 1, name: 'First Login', description: 'Logged in for the first time', icon: '🏅' },
    { id: 2, name: 'Course Finisher', description: 'Completed a course', icon: '🎓' },
    { id: 3, name: 'Quiz Master', description: 'Scored 100% on a quiz', icon: '💯' }
  ];
  private userBadges: UserBadge[] = [];
  private userPoints: { [userId: number]: number } = {};

  getBadges(): Badge[] {
    return this.badges;
  }

  getUserBadges(userId: number): UserBadge[] {
    return this.userBadges.filter(ub => ub.userId === userId);
  }

  awardBadge(userId: number, badgeId: number) {
    if (!this.userBadges.some(ub => ub.userId === userId && ub.badgeId === badgeId)) {
      this.userBadges.push({ userId, badgeId, awardedAt: new Date().toISOString() });
    }
  }

  addPoints(userId: number, points: number) {
    this.userPoints[userId] = (this.userPoints[userId] || 0) + points;
  }

  getPoints(userId: number): number {
    return this.userPoints[userId] || 0;
  }

  getLeaderboard(): { userId: number; points: number }[] {
    return Object.entries(this.userPoints)
      .map(([userId, points]) => ({ userId: Number(userId), points }))
      .sort((a, b) => b.points - a.points);
  }
}
