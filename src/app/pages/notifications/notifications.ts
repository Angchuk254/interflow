import { Component, OnInit, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements OnInit {
  readonly notificationService = inject(NotificationService);

  readonly unreadCount = computed(() => this.notificationService.unreadCount());
  readonly notifications = computed(() => this.notificationService.notifications());

  async ngOnInit(): Promise<void> {
    await this.notificationService.loadNotifications();
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationService.markAsRead(id);
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationService.markAllAsRead();
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      task_assigned: 'bi-check2-square',
      task_completed: 'bi-check-circle',
      interest_approved: 'bi-heart-fill',
      interest_rejected: 'bi-x-circle',
      project_update: 'bi-folder',
      comment: 'bi-chat-dots',
      mention: 'bi-at',
    };
    return icons[type] || 'bi-bell';
  }

  getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      task_assigned: 'primary',
      task_completed: 'success',
      interest_approved: 'success',
      interest_rejected: 'danger',
      project_update: 'info',
      comment: 'secondary',
      mention: 'warning',
    };
    return classes[type] || 'secondary';
  }

  formatDate(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
