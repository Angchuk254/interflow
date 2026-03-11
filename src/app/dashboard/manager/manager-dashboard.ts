import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../services/api';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import type { Project, Task, InterestRequest, Profile } from '../../interfaces/database.types';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './manager-dashboard.html',
  styleUrl: './manager-dashboard.scss',
})
export class ManagerDashboard implements OnInit {
  readonly api = inject(Api);
  readonly projectService = inject(ProjectService);
  readonly taskService = inject(TaskService);

  readonly loading = signal(true);

  // Stats
  readonly stats = signal({
    myProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    overdueTasks: 0,
    pendingReviews: 0,
    pendingInterests: 0,
  });

  // Data
  readonly myProjects = signal<Project[]>([]);
  readonly pendingInterests = signal<InterestRequest[]>([]);
  readonly tasksToReview = signal<Task[]>([]);
  readonly overdueTasks = signal<Task[]>([]);
  readonly teamMembers = signal<Profile[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      await this.loadDashboardData();
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDashboardData(): Promise<void> {
    const userId = this.api.user()?.id;
    if (!userId) return;

    // Get projects where user is manager
    const { data: managedProjectIds } = await this.api.supabase
      .from('project_managers')
      .select('project_id')
      .eq('user_id', userId);

    const projectIds = managedProjectIds?.map((p) => p.project_id) || [];

    if (projectIds.length > 0) {
      // Load managed projects
      const { data: projects } = await this.api.supabase
        .from('projects')
        .select(`*, creator:profiles!projects_created_by_fkey(full_name)`)
        .in('id', projectIds)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      this.myProjects.set((projects as Project[]) || []);

      // Load pending interests for managed projects
      const { data: interests } = await this.api.supabase
        .from('interest_requests')
        .select(`*, user:profiles!interest_requests_user_id_fkey(*), project:projects(title)`)
        .in('project_id', projectIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      this.pendingInterests.set((interests as InterestRequest[]) || []);

      // Load tasks pending review
      const { data: reviewTasks } = await this.api.supabase
        .from('tasks')
        .select(`*, project:projects(title), assignees:task_assignees(user:profiles(*))`)
        .in('project_id', projectIds)
        .eq('review_status', 'pending_review')
        .is('deleted_at', null);

      this.tasksToReview.set(this.mapTasks(reviewTasks || []));

      // Load overdue tasks
      const today = new Date().toISOString().split('T')[0];
      const { data: overdue } = await this.api.supabase
        .from('tasks')
        .select(`*, project:projects(title)`)
        .in('project_id', projectIds)
        .lt('expected_end_date', today)
        .neq('status', 'completed')
        .is('deleted_at', null);

      this.overdueTasks.set((overdue as Task[]) || []);

      // Load team members (contributors)
      const { data: contributors } = await this.api.supabase
        .from('project_contributors')
        .select(`user:profiles(*)`)
        .in('project_id', projectIds);

      const uniqueMembers = new Map<string, Profile>();
      contributors?.forEach((c: any) => {
        if (c.user) uniqueMembers.set(c.user.id, c.user);
      });
      this.teamMembers.set(Array.from(uniqueMembers.values()).slice(0, 8));

      // Calculate stats
      const activeCount = (projects as Project[])?.filter((p) => p.status === 'in_progress').length || 0;
      this.stats.set({
        myProjects: projectIds.length,
        activeProjects: activeCount,
        totalTasks: reviewTasks?.length || 0,
        overdueTasks: overdue?.length || 0,
        pendingReviews: reviewTasks?.length || 0,
        pendingInterests: interests?.length || 0,
      });
    }
  }

  private mapTasks(data: any[]): Task[] {
    return data.map((t) => ({
      ...t,
      assignees: t.assignees?.map((a: any) => a.user) || [],
    }));
  }

  async approveInterest(id: string): Promise<void> {
    await this.projectService.approveInterest(id);
    this.pendingInterests.update((list) => list.filter((i) => i.id !== id));
    this.stats.update((s) => ({ ...s, pendingInterests: s.pendingInterests - 1 }));
  }

  async rejectInterest(id: string): Promise<void> {
    await this.projectService.rejectInterest(id);
    this.pendingInterests.update((list) => list.filter((i) => i.id !== id));
    this.stats.update((s) => ({ ...s, pendingInterests: s.pendingInterests - 1 }));
  }

  async acceptTask(taskId: string): Promise<void> {
    await this.taskService.reviewTask(taskId, 'accepted');
    this.tasksToReview.update((list) => list.filter((t) => t.id !== taskId));
    this.stats.update((s) => ({ ...s, pendingReviews: s.pendingReviews - 1 }));
  }

  async requestChanges(taskId: string): Promise<void> {
    const note = prompt('Enter feedback for requested changes:');
    if (note) {
      await this.taskService.reviewTask(taskId, 'changes_requested', note);
      this.tasksToReview.update((list) => list.filter((t) => t.id !== taskId));
      this.stats.update((s) => ({ ...s, pendingReviews: s.pendingReviews - 1 }));
    }
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      not_started: 'secondary', in_progress: 'primary', completed: 'success',
      delayed: 'danger', on_hold: 'warning',
    };
    return map[status] || 'secondary';
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = { high: 'danger', medium: 'warning', low: 'info' };
    return map[priority] || 'secondary';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getInitials(name: string): string {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
