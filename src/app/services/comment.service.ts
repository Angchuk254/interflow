import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import type { ProjectComment, TaskComment } from '../interfaces/database.types';

@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private readonly api = inject(Api);

  async getProjectComments(projectId: string): Promise<ProjectComment[]> {
    const { data, error } = await this.api.supabase
      .from('project_comments')
      .select(`*, user:profiles(*)`)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ProjectComment[];
  }

  async addProjectComment(projectId: string, body: string): Promise<ProjectComment> {
    const userId = this.api.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await this.api.supabase
      .from('project_comments')
      .insert({ project_id: projectId, user_id: userId, body })
      .select(`*, user:profiles(*)`)
      .single();

    if (error) throw error;
    return data as ProjectComment;
  }

  async updateComment(commentId: string, body: string): Promise<void> {
    const { error } = await this.api.supabase
      .from('project_comments')
      .update({ body, edited_at: new Date().toISOString() })
      .eq('id', commentId);

    if (error) throw error;
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await this.api.supabase
      .from('project_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  }

  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await this.api.supabase
      .from('task_comments')
      .select(`*, user:profiles(*)`)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TaskComment[];
  }

  async addTaskComment(taskId: string, body: string): Promise<TaskComment> {
    const userId = this.api.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await this.api.supabase
      .from('task_comments')
      .insert({ task_id: taskId, user_id: userId, body })
      .select(`*, user:profiles(*)`)
      .single();

    if (error) throw error;
    return data as TaskComment;
  }
}
