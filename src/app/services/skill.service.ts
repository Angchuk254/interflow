import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import type { Skill, UserSkill, Proficiency } from '../interfaces/database.types';

@Injectable({
  providedIn: 'root',
})
export class SkillService {
  private readonly api = inject(Api);

  async getAllSkills(): Promise<Skill[]> {
    const { data, error } = await this.api.supabase
      .from('skills')
      .select('*')
      .order('category')
      .order('name');

    if (error) throw error;
    return data as Skill[];
  }

  async getSkillsByCategory(): Promise<Map<string, Skill[]>> {
    const skills = await this.getAllSkills();
    const grouped = new Map<string, Skill[]>();

    skills.forEach((skill) => {
      const category = skill.category || 'Other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(skill);
    });

    return grouped;
  }

  async getMySkills(): Promise<UserSkill[]> {
    const userId = this.api.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.api.supabase
      .from('user_skills')
      .select(`
        *,
        skill:skills(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as UserSkill[];
  }

  async getUserSkills(userId: string): Promise<UserSkill[]> {
    const { data, error } = await this.api.supabase
      .from('user_skills')
      .select(`
        *,
        skill:skills(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as UserSkill[];
  }

  async addSkill(skillId: string, proficiency: Proficiency = 'intermediate'): Promise<UserSkill> {
    const userId = this.api.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await this.api.supabase
      .from('user_skills')
      .insert({
        user_id: userId,
        skill_id: skillId,
        proficiency,
      })
      .select(`
        *,
        skill:skills(*)
      `)
      .single();

    if (error) throw error;
    return data as UserSkill;
  }

  async updateSkillProficiency(userSkillId: string, proficiency: Proficiency): Promise<void> {
    const { error } = await this.api.supabase
      .from('user_skills')
      .update({ proficiency })
      .eq('id', userSkillId);

    if (error) throw error;
  }

  async removeSkill(userSkillId: string): Promise<void> {
    const { error } = await this.api.supabase
      .from('user_skills')
      .delete()
      .eq('id', userSkillId);

    if (error) throw error;
  }

  async createSkill(name: string, category?: string): Promise<Skill> {
    const { data, error } = await this.api.supabase
      .from('skills')
      .insert({ name, category: category || null })
      .select()
      .single();

    if (error) throw error;
    return data as Skill;
  }

  async findUsersWithSkill(skillId: string): Promise<any[]> {
    const { data, error } = await this.api.supabase
      .from('user_skills')
      .select(`
        proficiency,
        user:profiles(id, full_name, email, department, availability)
      `)
      .eq('skill_id', skillId)
      .order('proficiency');

    if (error) throw error;
    return data || [];
  }
}
