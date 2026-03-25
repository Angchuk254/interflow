import { Injectable, inject, signal, effect } from '@angular/core';
import { Api } from './api';
import type { Notification } from '../interfaces/database.types';

/** Optional FKs for DB triggers to delete rows when project/task is soft-deleted. */
export type NotificationEntityRefs = {
  projectId?: string;
  taskId?: string;
};
import type { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly api = inject(Api);
  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount = signal(0);
  private channel: RealtimeChannel | null = null;
  private initialized = false;

  constructor() {
    // Auto-initialize when user is available
    effect(() => {
      const user = this.api.user();
      if (user && !this.initialized) {
        this.initialize();
      } else if (!user) {
        this.cleanup();
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.loadNotifications();
    this.subscribeToRealtime();
  }

  private subscribeToRealtime(): void {
    const userId = this.api.user()?.id;
    if (!userId) return;

    this.channel = this.api.supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          this.notifications.update((list) => [newNotification, ...list]);
          this.unreadCount.update((count) => count + 1);
        }
      )
      .subscribe();
  }

  private cleanup(): void {
    if (this.channel) {
      this.api.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.initialized = false;
    this.notifications.set([]);
    this.unreadCount.set(0);
  }

  async loadNotifications(): Promise<Notification[]> {
    const userId = this.api.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.api.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to load notifications:', error);
      return [];
    }

    const notifications = data as Notification[];
    this.notifications.set(notifications);
    this.unreadCount.set(notifications.filter((n) => !n.is_read).length);

    return notifications;
  }

  async markAsRead(id: string): Promise<void> {
    const { error } = await this.api.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) return;

    this.notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    this.unreadCount.update((count) => Math.max(0, count - 1));
  }

  async markAllAsRead(): Promise<void> {
    const userId = this.api.user()?.id;
    if (!userId) return;

    const { error } = await this.api.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) return;

    this.notifications.update((list) => list.map((n) => ({ ...n, is_read: true })));
    this.unreadCount.set(0);
  }

  async refresh(): Promise<void> {
    await this.loadNotifications();
  }

  async createNotification(
    userId: string,
    type: string,
    title: string,
    body?: string,
    link?: string,
    refs?: NotificationEntityRefs,
  ): Promise<void> {
    await this.api.supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      link,
      ...(refs?.projectId != null ? { project_id: refs.projectId } : {}),
      ...(refs?.taskId != null ? { task_id: refs.taskId } : {}),
    });
  }

  async notifyAllUsers(
    type: string,
    title: string,
    body?: string,
    link?: string,
    excludeUserId?: string,
    refs?: NotificationEntityRefs,
  ): Promise<void> {
    const { data: users } = await this.api.supabase
      .from('profiles')
      .select('id')
      .eq('status', 'active');

    if (!users?.length) return;

    const notifications = users
      .filter((u) => u.id !== excludeUserId)
      .map((u) => ({
        user_id: u.id,
        type,
        title,
        body,
        link,
        ...(refs?.projectId != null ? { project_id: refs.projectId } : {}),
        ...(refs?.taskId != null ? { task_id: refs.taskId } : {}),
      }));

    if (notifications.length > 0) {
      await this.api.supabase.from('notifications').insert(notifications);
    }
  }

  async notifyUsers(
    userIds: string[],
    type: string,
    title: string,
    body?: string,
    link?: string,
    refs?: NotificationEntityRefs,
  ): Promise<void> {
    if (userIds.length === 0) return;

    const notifications = userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      body,
      link,
      ...(refs?.projectId != null ? { project_id: refs.projectId } : {}),
      ...(refs?.taskId != null ? { task_id: refs.taskId } : {}),
    }));

    await this.api.supabase.from('notifications').insert(notifications);
  }
}
