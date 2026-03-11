import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import type { TimeLog } from '../interfaces/database.types';

@Injectable({
  providedIn: 'root',
})
export class TimeTrackingService {
  private readonly api = inject(Api);

  async getMyTimeLogs(startDate?: string, endDate?: string): Promise<TimeLog[]> {
    const userId = this.api.user()?.id;
    if (!userId) return [];

    let query = this.api.supabase
      .from('time_logs')
      .select(`
        *,
        task:tasks(id, title, project:projects(id, title))
      `)
      .eq('user_id', userId)
      .order('log_date', { ascending: false });

    if (startDate) {
      query = query.gte('log_date', startDate);
    }
    if (endDate) {
      query = query.lte('log_date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as TimeLog[];
  }

  async getTaskTimeLogs(taskId: string): Promise<TimeLog[]> {
    const { data, error } = await this.api.supabase
      .from('time_logs')
      .select(`
        *,
        user:profiles(id, full_name, email)
      `)
      .eq('task_id', taskId)
      .order('log_date', { ascending: false });

    if (error) throw error;
    return data as TimeLog[];
  }

  async getProjectTimeLogs(projectId: string): Promise<TimeLog[]> {
    const { data: tasks } = await this.api.supabase
      .from('tasks')
      .select('id')
      .eq('project_id', projectId);

    if (!tasks?.length) return [];

    const taskIds = tasks.map((t) => t.id);
    const { data, error } = await this.api.supabase
      .from('time_logs')
      .select(`
        *,
        task:tasks(id, title),
        user:profiles(id, full_name)
      `)
      .in('task_id', taskIds)
      .order('log_date', { ascending: false });

    if (error) throw error;
    return data as TimeLog[];
  }

  async logTime(taskId: string, hours: number, description?: string, logDate?: string): Promise<TimeLog> {
    const userId = this.api.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await this.api.supabase
      .from('time_logs')
      .insert({
        user_id: userId,
        task_id: taskId,
        hours,
        description: description || null,
        log_date: logDate || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;
    return data as TimeLog;
  }

  async updateTimeLog(id: string, hours: number, description?: string): Promise<TimeLog> {
    const { data, error } = await this.api.supabase
      .from('time_logs')
      .update({
        hours,
        description: description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as TimeLog;
  }

  async deleteTimeLog(id: string): Promise<void> {
    const { error } = await this.api.supabase
      .from('time_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getWeeklyHours(userId?: string): Promise<number> {
    const targetUserId = userId || this.api.user()?.id;
    if (!targetUserId) return 0;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const { data, error } = await this.api.supabase
      .from('time_logs')
      .select('hours')
      .eq('user_id', targetUserId)
      .gte('log_date', weekStart.toISOString().split('T')[0]);

    if (error) return 0;
    return data.reduce((sum, log) => sum + Number(log.hours), 0);
  }

  async getMonthlyHours(userId?: string): Promise<number> {
    const targetUserId = userId || this.api.user()?.id;
    if (!targetUserId) return 0;

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data, error } = await this.api.supabase
      .from('time_logs')
      .select('hours')
      .eq('user_id', targetUserId)
      .gte('log_date', monthStart.toISOString().split('T')[0]);

    if (error) return 0;
    return data.reduce((sum, log) => sum + Number(log.hours), 0);
  }
}
