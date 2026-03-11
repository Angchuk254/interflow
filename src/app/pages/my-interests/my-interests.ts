import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../services/api';
import type { InterestRequest } from '../../interfaces/database.types';

@Component({
  selector: 'app-my-interests',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './my-interests.html',
  styleUrl: './my-interests.scss',
})
export class MyInterests implements OnInit {
  readonly api = inject(Api);
  readonly loading = signal(true);
  readonly interests = signal<InterestRequest[]>([]);
  readonly selectedTab = signal<'all' | 'pending' | 'approved' | 'rejected'>('all');

  readonly filteredInterests = computed(() => {
    const tab = this.selectedTab();
    if (tab === 'all') return this.interests();
    return this.interests().filter((i) => i.status === tab);
  });

  readonly stats = computed(() => {
    const all = this.interests();
    return {
      total: all.length,
      pending: all.filter((i) => i.status === 'pending').length,
      approved: all.filter((i) => i.status === 'approved').length,
      rejected: all.filter((i) => i.status === 'rejected').length,
    };
  });

  async ngOnInit(): Promise<void> {
    try {
      const userId = this.api.user()?.id;
      if (!userId) return;

      const { data, error } = await this.api.supabase
        .from('interest_requests')
        .select(`
          *,
          project:projects(id, title, brief, status, priority),
          reviewer:profiles!interest_requests_reviewed_by_fkey(full_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        this.interests.set(data as InterestRequest[]);
      }
    } finally {
      this.loading.set(false);
    }
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: 'bi-hourglass-split',
      approved: 'bi-check-circle-fill',
      rejected: 'bi-x-circle-fill',
    };
    return icons[status] || 'bi-circle';
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
    };
    return classes[status] || 'secondary';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatRelativeTime(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return this.formatDate(date);
  }
}
