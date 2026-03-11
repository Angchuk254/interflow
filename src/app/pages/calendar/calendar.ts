import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../services/api';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import type { Task, Project } from '../../interfaces/database.types';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  projects: Project[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar implements OnInit {
  readonly api = inject(Api);
  readonly taskService = inject(TaskService);
  readonly projectService = inject(ProjectService);

  readonly loading = signal(true);
  readonly currentDate = signal(new Date());
  readonly tasks = signal<Task[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly selectedDay = signal<CalendarDay | null>(null);

  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  readonly currentMonth = computed(() => {
    const date = this.currentDate();
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

  readonly calendarDays = computed(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allTasks = this.tasks();
    const allProjects = this.projects();

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const dateStr = currentDate.toISOString().split('T')[0];

      const dayTasks = allTasks.filter((t) => t.expected_end_date === dateStr);
      const dayProjects = allProjects.filter((p) => p.expected_end_date === dateStr);

      days.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.getTime() === today.getTime(),
        tasks: dayTasks,
        projects: dayProjects,
      });
    }

    return days;
  });

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const role = this.api.userRole();

      if (role === 'admin') {
        const [tasks, projects] = await Promise.all([
          this.taskService.getTasks(),
          this.projectService.getProjects(),
        ]);
        this.tasks.set(tasks);
        this.projects.set(projects);
      } else if (role === 'manager') {
        const [tasks, projects] = await Promise.all([
          this.taskService.getManagerTasks(),
          this.projectService.getManagerProjects(),
        ]);
        this.tasks.set(tasks);
        this.projects.set(projects);
      } else {
        const [tasks, projects] = await Promise.all([
          this.taskService.getMyTasks(),
          this.projectService.getMyProjects(),
        ]);
        this.tasks.set(tasks);
        this.projects.set(projects);
      }
    } finally {
      this.loading.set(false);
    }
  }

  prevMonth(): void {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }

  goToToday(): void {
    this.currentDate.set(new Date());
  }

  selectDay(day: CalendarDay): void {
    if (day.tasks.length > 0 || day.projects.length > 0) {
      this.selectedDay.set(day);
    }
  }

  closeDetail(): void {
    this.selectedDay.set(null);
  }

  hasEvents(day: CalendarDay): boolean {
    return day.tasks.length > 0 || day.projects.length > 0;
  }

  getPriorityClass(priority: string): string {
    return { high: 'danger', medium: 'warning', low: 'secondary' }[priority] || 'secondary';
  }

  getStatusClass(status: string): string {
    return { completed: 'success', in_progress: 'primary', delayed: 'danger' }[status] || 'secondary';
  }
}
