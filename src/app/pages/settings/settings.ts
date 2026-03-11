import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../services/api';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  readonly api = inject(Api);
  readonly saving = signal(false);
  readonly message = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  settings = {
    emailNotifications: true,
    taskReminders: true,
    projectUpdates: true,
    interestAlerts: true,
  };

  async saveSettings(): Promise<void> {
    this.saving.set(true);
    this.message.set(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.message.set({ type: 'success', text: 'Settings saved successfully!' });
    } catch {
      this.message.set({ type: 'error', text: 'Failed to save settings' });
    } finally {
      this.saving.set(false);
    }
  }
}
