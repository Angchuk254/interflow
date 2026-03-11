import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard, adminOrManagerGuard, userOnlyGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    loadComponent: () => import('./user/login/login').then((m) => m.Login),
  },
  {
    path: 'accept-invite',
    loadComponent: () => import('./user/accept-invite/accept-invite').then((m) => m.AcceptInvite),
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    canActivate: [authGuard],
    children: [
      // Dashboard - redirects based on role
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'dashboard/admin',
        loadComponent: () => import('./dashboard/admin/admin-dashboard').then((m) => m.AdminDashboard),
        canActivate: [adminGuard],
      },
      {
        path: 'dashboard/manager',
        loadComponent: () => import('./dashboard/manager/manager-dashboard').then((m) => m.ManagerDashboard),
        canActivate: [adminOrManagerGuard],
      },
      {
        path: 'dashboard/employee',
        loadComponent: () => import('./dashboard/employee/employee-dashboard').then((m) => m.EmployeeDashboard),
        canActivate: [userOnlyGuard],
      },

      // Projects - All can view, but different capabilities
      {
        path: 'projects',
        loadComponent: () => import('./pages/projects/projects').then((m) => m.Projects),
      },
      {
        path: 'projects/new',
        loadComponent: () => import('./pages/project-form/project-form').then((m) => m.ProjectForm),
        canActivate: [adminOrManagerGuard], // Admin and Manager can create projects
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./pages/project-detail/project-detail').then((m) => m.ProjectDetail),
      },
      {
        path: 'projects/:id/edit',
        loadComponent: () => import('./pages/project-form/project-form').then((m) => m.ProjectForm),
        canActivate: [adminOrManagerGuard],
      },

      // Tasks - different views based on role
      {
        path: 'tasks',
        loadComponent: () => import('./pages/tasks/tasks').then((m) => m.Tasks),
      },
      {
        path: 'projects/:projectId/tasks/new',
        loadComponent: () => import('./pages/task-form/task-form').then((m) => m.TaskForm),
        canActivate: [adminOrManagerGuard],
      },

      // My Work - User only (employees)
      {
        path: 'my-work',
        loadComponent: () => import('./pages/my-work/my-work').then((m) => m.MyWork),
        canActivate: [userOnlyGuard],
      },

      // Task Board (Kanban) - User only
      {
        path: 'task-board',
        loadComponent: () => import('./pages/task-board/task-board').then((m) => m.TaskBoard),
        canActivate: [userOnlyGuard],
      },

      // My Interests - User only
      {
        path: 'my-interests',
        loadComponent: () => import('./pages/my-interests/my-interests').then((m) => m.MyInterests),
        canActivate: [userOnlyGuard],
      },

      // Interest Requests Review - Admin & Manager
      {
        path: 'interests',
        loadComponent: () => import('./pages/interests/interests').then((m) => m.Interests),
        canActivate: [adminOrManagerGuard],
      },

      // Team - Admin & Manager
      {
        path: 'team',
        loadComponent: () => import('./pages/team/team').then((m) => m.Team),
        canActivate: [adminOrManagerGuard],
      },

      // User Management - Admin only
      {
        path: 'users',
        loadComponent: () => import('./pages/user-management/user-management').then((m) => m.UserManagement),
        canActivate: [adminGuard],
      },

      // Activity Log - Admin only
      {
        path: 'activity',
        loadComponent: () => import('./pages/activity/activity').then((m) => m.Activity),
        canActivate: [adminGuard],
      },

      // Calendar - All can view their relevant items
      {
        path: 'calendar',
        loadComponent: () => import('./pages/calendar/calendar').then((m) => m.Calendar),
      },

      // Notifications - All
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications').then((m) => m.Notifications),
      },

      // Settings & Profile - All
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
