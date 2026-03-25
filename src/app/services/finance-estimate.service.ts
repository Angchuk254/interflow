import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import type {
  FinanceEstimateLine,
  FinanceEstimateRevision,
  FinanceEstimateStatus,
  ProjectFinanceEstimate,
} from '../interfaces/database.types';

export interface EstimateLineInput {
  resourceLabel: string;
  hours: number;
  ratePerHour: number;
}

@Injectable({
  providedIn: 'root',
})
export class FinanceEstimateService {
  private readonly api = inject(Api);

  displayTitle(e: ProjectFinanceEstimate): string {
    const override = e.display_name?.trim();
    if (override) return override;
    if (e.project_id && e.project?.title) {
      return e.project.title;
    }
    const t = e.custom_title?.trim();
    return t || 'Untitled estimate';
  }

  async createAndSubmitEstimate(params: {
    projectId: string | null;
    customTitle: string | null;
    /** When projectId is set, optional label for finance (overrides project title). */
    displayName: string | null;
    clientName: string | null;
    companyName: string | null;
    marginPercent: number;
    lines: EstimateLineInput[];
  }): Promise<{ id: string }> {
    const userId = this.api.user()?.id;
    if (!userId) throw new Error('Not signed in');

    const { data: est, error: eErr } = await this.api.supabase
      .from('project_finance_estimates')
      .insert({
        submitted_by: userId,
        project_id: params.projectId,
        custom_title: params.customTitle?.trim() || null,
        display_name:
          params.projectId != null ? params.displayName?.trim() || null : null,
        client_name: params.clientName?.trim() || null,
        company_name: params.companyName?.trim() || null,
        margin_percent: params.marginPercent,
        status: 'submitted' as FinanceEstimateStatus,
      })
      .select('id')
      .single();

    if (eErr) throw eErr;
    if (!est?.id) throw new Error('No estimate id returned');

    await this.replaceLines(est.id, params.lines);
    await this.appendRevision(est.id, 'Submitted to Finance');
    return { id: est.id };
  }

  /** Append a history snapshot (current DB state). Call after PM/Finance saves and after approve. */
  async appendRevision(estimateId: string, summary: string): Promise<void> {
    const uid = this.api.user()?.id;
    if (!uid) throw new Error('Not signed in');
    const est = await this.fetchEstimateById(estimateId);
    if (!est) throw new Error('Estimate not found');
    const lines = await this.fetchLines(estimateId);
    const linesPayload = lines.map((l) => {
      const h = Math.max(0, Number(l.hours));
      const r = Math.max(0, Number(l.rate_per_hour));
      return {
        resource_label: l.resource_label,
        hours: h,
        rate_per_hour: r,
        line_total: h * r,
      };
    });
    const { error } = await this.api.supabase.from('project_finance_estimate_revisions').insert({
      estimate_id: estimateId,
      actor_id: uid,
      summary,
      margin_percent: Number(est.margin_percent),
      status: est.status,
      lines_snapshot: linesPayload,
    });
    if (error) throw error;
  }

  async listRevisions(estimateId: string): Promise<FinanceEstimateRevision[]> {
    const { data, error } = await this.api.supabase
      .from('project_finance_estimate_revisions')
      .select(
        `
        *,
        actor:profiles!project_finance_estimate_revisions_actor_id_fkey(full_name, email)
      `,
      )
      .eq('estimate_id', estimateId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as FinanceEstimateRevision & { lines_snapshot: unknown };
      return {
        ...r,
        lines_snapshot: Array.isArray(r.lines_snapshot) ? r.lines_snapshot : [],
      } as FinanceEstimateRevision;
    });
  }

  async replaceLines(estimateId: string, lines: EstimateLineInput[]): Promise<void> {
    const { error: dErr } = await this.api.supabase
      .from('finance_estimate_lines')
      .delete()
      .eq('estimate_id', estimateId);
    if (dErr) throw dErr;

    if (lines.length === 0) return;

    const rows = lines.map((l, i) => ({
      estimate_id: estimateId,
      sort_order: i,
      resource_label: l.resourceLabel,
      hours: l.hours,
      rate_per_hour: l.ratePerHour,
    }));

    const { error: iErr } = await this.api.supabase.from('finance_estimate_lines').insert(rows);
    if (iErr) throw iErr;
  }

  async fetchEstimateById(id: string): Promise<ProjectFinanceEstimate | null> {
    const { data, error } = await this.api.supabase
      .from('project_finance_estimates')
      .select(
        `
        *,
        submitter:profiles!project_finance_estimates_submitted_by_fkey(id, full_name, email),
        project:projects!project_finance_estimates_project_id_fkey(title)
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as ProjectFinanceEstimate | null;
  }

  async fetchLines(estimateId: string): Promise<FinanceEstimateLine[]> {
    const { data, error } = await this.api.supabase
      .from('finance_estimate_lines')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as FinanceEstimateLine[];
  }

  async listInboxEstimates(): Promise<ProjectFinanceEstimate[]> {
    const { data, error } = await this.api.supabase
      .from('project_finance_estimates')
      .select(
        `
        *,
        submitter:profiles!project_finance_estimates_submitted_by_fkey(id, full_name, email),
        project:projects!project_finance_estimates_project_id_fkey(title)
      `,
      )
      .in('status', ['submitted', 'approved'])
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ProjectFinanceEstimate[];
  }

  /** Admin/finance: full inbox. Manager: only their own. */
  async listForProjectFinancePage(): Promise<ProjectFinanceEstimate[]> {
    if (this.api.isAdmin() || this.api.isFinance()) {
      return this.listInboxEstimates();
    }
    return this.listMySubmittedEstimates();
  }

  /** Project Manager: all estimates they submitted (submitted or approved). */
  async listMySubmittedEstimates(): Promise<ProjectFinanceEstimate[]> {
    const uid = this.api.user()?.id;
    if (!uid) return [];

    const { data, error } = await this.api.supabase
      .from('project_finance_estimates')
      .select(
        `
        *,
        submitter:profiles!project_finance_estimates_submitted_by_fkey(id, full_name, email),
        project:projects!project_finance_estimates_project_id_fkey(title)
      `,
      )
      .eq('submitted_by', uid)
      .in('status', ['submitted', 'approved'])
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ProjectFinanceEstimate[];
  }

  /** Live refresh for PM list when any of their estimate rows change (including Finance edits). */
  subscribeMyEstimates(onEvent: () => void): () => void {
    const uid = this.api.user()?.id;
    if (!uid) return () => {};

    const ch = this.api.supabase
      .channel(`pm-my-estimates-${uid}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_finance_estimates',
          filter: `submitted_by=eq.${uid}`,
        },
        () => onEvent(),
      )
      .subscribe();

    return () => {
      void this.api.supabase.removeChannel(ch);
    };
  }

  /**
   * Hard-delete an estimate: remove lines and revisions first, then the header.
   * Avoids CASCADE + RLS on child tables. Falls back to RPC if the header row remains.
   */
  async deleteEstimate(id: string): Promise<void> {
    const trimmed = id?.trim();
    if (!trimmed) throw new Error('Missing estimate id');

    const { error: linesErr } = await this.api.supabase
      .from('finance_estimate_lines')
      .delete()
      .eq('estimate_id', trimmed);
    if (linesErr) throw linesErr;

    const { error: revErr } = await this.api.supabase
      .from('project_finance_estimate_revisions')
      .delete()
      .eq('estimate_id', trimmed);
    if (revErr) throw revErr;

    const { error: headErr } = await this.api.supabase
      .from('project_finance_estimates')
      .delete()
      .eq('id', trimmed);
    if (headErr) throw headErr;

    if (await this.isEstimateAbsent(trimmed)) return;

    const rpc = await this.api.supabase.rpc('delete_project_finance_estimate', {
      estimate_id: trimmed,
    });

    if (!rpc.error) {
      if (rpc.data === true) return;
      if (rpc.data !== false && (await this.isEstimateAbsent(trimmed))) return;
      this.throwDeleteNotApplied();
    }

    if (this.isRpcUnavailable(rpc.error)) {
      this.throwDeleteNotApplied();
    }

    throw rpc.error;
  }

  private isRpcUnavailable(err: { code?: string; message?: string } | null): boolean {
    if (!err) return false;
    const m = (err.message ?? '').toLowerCase();
    return (
      err.code === 'PGRST202' ||
      err.code === '42883' ||
      m.includes('could not find the function') ||
      (m.includes('function') && m.includes('does not exist')) ||
      m.includes('schema cache')
    );
  }

  private async isEstimateAbsent(id: string): Promise<boolean> {
    const { data, error } = await this.api.supabase
      .from('project_finance_estimates')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data == null;
  }

  private throwDeleteNotApplied(): never {
    throw new Error(
      'Could not delete this estimate. You may only remove your own estimates before they are approved.',
    );
  }

  async updateEstimateFields(
    id: string,
    fields: {
      margin_percent?: number;
      status?: FinanceEstimateStatus;
      project_id?: string | null;
      custom_title?: string | null;
      display_name?: string | null;
      client_name?: string | null;
      company_name?: string | null;
    },
  ): Promise<void> {
    const { error } = await this.api.supabase.from('project_finance_estimates').update(fields).eq('id', id);
    if (error) throw error;
  }

  /**
   * Subscribe to estimate header + line changes (respects RLS; only events for rows you can read).
   */
  subscribeEstimate(estimateId: string, onEvent: () => void): () => void {
    const ch = this.api.supabase
      .channel(`estimate-${estimateId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_finance_estimates',
          filter: `id=eq.${estimateId}`,
        },
        () => onEvent(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'finance_estimate_lines',
          filter: `estimate_id=eq.${estimateId}`,
        },
        () => onEvent(),
      )
      .subscribe();

    return () => {
      void this.api.supabase.removeChannel(ch);
    };
  }

  /** Finance inbox: any estimate row change (insert/update/delete). */
  subscribeInbox(onEvent: () => void): () => void {
    const ch = this.api.supabase
      .channel(`finance-inbox-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_finance_estimates',
        },
        () => onEvent(),
      )
      .subscribe();

    return () => {
      void this.api.supabase.removeChannel(ch);
    };
  }
}
