import { Injectable, inject, signal, computed } from '@angular/core';
import { Api } from './api';
import type { FavoriteProject, Project } from '../interfaces/database.types';

@Injectable({
  providedIn: 'root',
})
export class FavoriteService {
  private readonly api = inject(Api);

  private readonly favorites = signal<string[]>([]);
  readonly favoriteIds = computed(() => this.favorites());

  async loadFavorites(): Promise<void> {
    const userId = this.api.user()?.id;
    if (!userId) return;

    const { data, error } = await this.api.supabase
      .from('favorite_projects')
      .select('project_id')
      .eq('user_id', userId);

    if (!error && data) {
      this.favorites.set(data.map((f) => f.project_id));
    }
  }

  async getFavoriteProjects(): Promise<Project[]> {
    const userId = this.api.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.api.supabase
      .from('favorite_projects')
      .select(`
        project:projects(
          *,
          creator:profiles!projects_created_by_fkey(*),
          tags:project_tags(tag:tags(*))
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data?.map((f: any) => ({
      ...f.project,
      tags: f.project.tags?.map((t: any) => t.tag) || [],
    })) || [];
  }

  isFavorite(projectId: string): boolean {
    return this.favorites().includes(projectId);
  }

  async toggleFavorite(projectId: string): Promise<boolean> {
    const userId = this.api.user()?.id;
    if (!userId) return false;

    const isFav = this.isFavorite(projectId);

    if (isFav) {
      const { error } = await this.api.supabase
        .from('favorite_projects')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);

      if (!error) {
        this.favorites.update((list) => list.filter((id) => id !== projectId));
      }
      return false;
    } else {
      const { error } = await this.api.supabase
        .from('favorite_projects')
        .insert({ user_id: userId, project_id: projectId });

      if (!error) {
        this.favorites.update((list) => [...list, projectId]);
      }
      return true;
    }
  }

  async addFavorite(projectId: string): Promise<void> {
    const userId = this.api.user()?.id;
    if (!userId) return;

    const { error } = await this.api.supabase
      .from('favorite_projects')
      .insert({ user_id: userId, project_id: projectId });

    if (!error) {
      this.favorites.update((list) => [...list, projectId]);
    }
  }

  async removeFavorite(projectId: string): Promise<void> {
    const userId = this.api.user()?.id;
    if (!userId) return;

    const { error } = await this.api.supabase
      .from('favorite_projects')
      .delete()
      .eq('user_id', userId)
      .eq('project_id', projectId);

    if (!error) {
      this.favorites.update((list) => list.filter((id) => id !== projectId));
    }
  }
}
