import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../services/api';
import { UserService } from '../../services/user.service';
import type { Profile, UserRole } from '../../interfaces/database.types';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team implements OnInit {
  readonly api = inject(Api);
  readonly userService = inject(UserService);

  readonly loading = signal(true);
  readonly users = signal<Profile[]>([]);
  readonly searchQuery = signal('');
  readonly selectedRole = signal<string>('all');

  readonly filteredUsers = computed(() => {
    let result = this.users();
    const query = this.searchQuery().toLowerCase();
    const role = this.selectedRole();

    if (query) {
      result = result.filter(
        (u) => u.full_name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
      );
    }
    if (role !== 'all') {
      result = result.filter((u) => u.role === role);
    }
    return result;
  });

  async ngOnInit(): Promise<void> {
    try {
      const users = await this.userService.getUsers();
      this.users.set(users);
    } finally {
      this.loading.set(false);
    }
  }

  async changeRole(user: Profile, newRole: UserRole): Promise<void> {
    try {
      await this.userService.updateUser(user.id, { role: newRole });
      this.users.update((list) =>
        list.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      alert('Failed to update role');
    }
  }

  getRoleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      admin: 'danger',
      manager: 'primary',
      user: 'secondary',
    };
    return map[role] || 'secondary';
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      active: 'success',
      invited: 'warning',
      deactivated: 'danger',
    };
    return map[status] || 'secondary';
  }
}
