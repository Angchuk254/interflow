import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, NgZone, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EstimateRevisionHistory } from '../../components/estimate-revision-history/estimate-revision-history';
import { FinanceEstimateService } from '../../services/finance-estimate.service';
import { SnackbarService } from '../../services/snackbar.service';
import type { FinanceEstimateLine, ProjectFinanceEstimate } from '../../interfaces/database.types';

function newDetailLine(estimateId: string, sortOrder: number): FinanceEstimateLine {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  return {
    id,
    estimate_id: estimateId,
    sort_order: sortOrder,
    resource_label: '',
    hours: 0,
    rate_per_hour: 0,
    created_at: '',
    updated_at: '',
  };
}

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, EstimateRevisionHistory],
  templateUrl: './finance-dashboard.html',
  styleUrl: './finance-dashboard.scss',
})
export class FinanceDashboard implements OnInit, OnDestroy {
  private readonly estimates = inject(FinanceEstimateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly ngZone = inject(NgZone);

  readonly loading = signal(true);
  readonly rows = signal<ProjectFinanceEstimate[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<ProjectFinanceEstimate | null>(null);
  readonly detailLoading = signal(false);

  /** Editable copy of lines for the open estimate (plain array for ngModel). */
  detailLines: FinanceEstimateLine[] = [];
  marginEdit = 0;
  headerDisplayName = '';
  headerClientName = '';
  headerCompanyName = '';

  saving = false;
  approving = false;
  deleting = false;
  /** In-app delete confirmation (no browser confirm). */
  readonly deletePrompt = signal<{ id: string; title: string } | null>(null);
  readonly historyRefresh = signal(0);

  private unsubInbox: (() => void) | null = null;
  private unsubDetail: (() => void) | null = null;
  private inboxDebounce: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    await this.refreshList();
    this.loading.set(false);
    this.unsubInbox = this.estimates.subscribeInbox(() => this.scheduleInboxRefresh());
  }

  ngOnDestroy(): void {
    this.unsubInbox?.();
    this.unsubDetail?.();
    if (this.inboxDebounce) clearTimeout(this.inboxDebounce);
  }

  private scheduleInboxRefresh(): void {
    if (this.inboxDebounce) clearTimeout(this.inboxDebounce);
    this.inboxDebounce = setTimeout(() => {
      void this.refreshList();
      const sid = this.selectedId();
      if (sid) void this.pullDetail(sid);
    }, 120);
  }

  async refreshList(): Promise<void> {
    try {
      const list = await this.estimates.listInboxEstimates();
      this.ngZone.run(() => this.rows.set(list));
    } catch (e) {
      console.error(e);
      this.ngZone.run(() => this.rows.set([]));
    }
  }

  title(e: ProjectFinanceEstimate): string {
    return this.estimates.displayTitle(e);
  }

  clientCompanyLine(e: ProjectFinanceEstimate): string {
    const c = e.client_name?.trim();
    const co = e.company_name?.trim();
    if (c && co) return `${c} · ${co}`;
    return c || co || '';
  }

  async selectRow(id: string): Promise<void> {
    this.deletePrompt.set(null);
    this.selectedId.set(id);
    this.unsubDetail?.();
    this.unsubDetail = null;
    this.detail.set(null);
    this.detailLines = [];
    this.detailLoading.set(true);
    try {
      await this.pullDetail(id);
    } finally {
      this.detailLoading.set(false);
    }
    if (this.selectedId() === id && this.detail()) {
      this.unsubDetail = this.estimates.subscribeEstimate(id, () => {
        void this.pullDetail(id);
      });
    }
  }

  clearSelection(): void {
    this.deletePrompt.set(null);
    this.selectedId.set(null);
    this.detail.set(null);
    this.detailLines = [];
    this.headerDisplayName = '';
    this.headerClientName = '';
    this.headerCompanyName = '';
    this.unsubDetail?.();
    this.unsubDetail = null;
  }

  private async pullDetail(id: string): Promise<void> {
    try {
      const est = await this.estimates.fetchEstimateById(id);
      if (this.selectedId() !== id) return;
      if (!est) {
        this.detail.set(null);
        this.detailLines = [];
        this.snackbar.error('Estimate not found.');
        this.clearSelection();
        return;
      }
      this.detail.set(est);
      this.marginEdit = Number(est.margin_percent);
      this.headerDisplayName = est.display_name?.trim() ?? '';
      this.headerClientName = est.client_name?.trim() ?? '';
      this.headerCompanyName = est.company_name?.trim() ?? '';
      const ls = await this.estimates.fetchLines(id);
      if (this.selectedId() !== id) return;
      this.detailLines = [...ls];
      if (this.detailLines.length === 0) {
        this.detailLines = [newDetailLine(id, 0)];
      }
    } catch {
      this.snackbar.error('Could not load estimate.');
      if (this.selectedId() === id) {
        this.clearSelection();
      }
    }
  }

  lineAmount(line: FinanceEstimateLine): number {
    return Math.max(0, Number(line.hours)) * Math.max(0, Number(line.rate_per_hour));
  }

  getSubtotal(): number {
    return this.detailLines.reduce((s, l) => s + this.lineAmount(l), 0);
  }

  getTotalWithMargin(): number {
    const m = Math.max(0, this.marginEdit);
    return this.getSubtotal() * (1 + m / 100);
  }

  canEditDetail(): boolean {
    return this.detail()?.status !== 'approved';
  }

  canDeleteSelected(): boolean {
    return this.detail()?.status !== 'approved';
  }

  requestDeleteSelected(): void {
    const id = this.selectedId();
    const d = this.detail();
    if (!id || !d || !this.canDeleteSelected()) return;
    this.deletePrompt.set({ id, title: this.title(d) });
  }

  cancelDeletePrompt(): void {
    this.deletePrompt.set(null);
  }

  async confirmDeleteSelected(): Promise<void> {
    const p = this.deletePrompt();
    if (!p || p.id !== this.selectedId()) return;
    this.deleting = true;
    try {
      await this.estimates.deleteEstimate(p.id);
      this.ngZone.run(() => {
        this.deletePrompt.set(null);
        this.rows.update((list) => list.filter((r) => r.id !== p.id));
        this.clearSelection();
      });
      await this.refreshList();
      this.snackbar.success('Estimate removed from the database.');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Delete failed';
      this.snackbar.error(msg);
      await this.refreshList();
    } finally {
      this.ngZone.run(() => {
        this.deleting = false;
      });
    }
  }

  addLine(): void {
    if (!this.canEditDetail()) return;
    const id = this.selectedId();
    if (!id) return;
    this.detailLines = [...this.detailLines, newDetailLine(id, this.detailLines.length)];
  }

  removeLine(index: number): void {
    if (!this.canEditDetail()) return;
    if (this.detailLines.length <= 1) return;
    this.detailLines = this.detailLines.filter((_, i) => i !== index);
  }

  async saveDetail(): Promise<void> {
    const id = this.selectedId();
    const d = this.detail();
    if (!id || !d || !this.canEditDetail()) return;

    this.saving = true;
    try {
      await this.estimates.updateEstimateFields(id, {
        margin_percent: this.marginEdit,
        display_name: d.project_id ? this.headerDisplayName.trim() || null : null,
        client_name: this.headerClientName.trim() || null,
        company_name: this.headerCompanyName.trim() || null,
      });
      await this.estimates.replaceLines(
        id,
        this.detailLines.map((l) => ({
          resourceLabel: l.resource_label,
          hours: Number(l.hours),
          ratePerHour: Number(l.rate_per_hour),
        })),
      );
      await this.pullDetail(id);
      await this.refreshList();
      await this.estimates.appendRevision(id, 'Finance update');
      this.historyRefresh.update((x) => x + 1);
      this.snackbar.success('Saved. Project Managers subscribed to this estimate will see updates live.');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Save failed';
      this.snackbar.error(msg);
    } finally {
      this.saving = false;
    }
  }

  async approveDetail(): Promise<void> {
    const id = this.selectedId();
    if (!id || this.detail()?.status === 'approved') return;

    this.approving = true;
    try {
      await this.estimates.updateEstimateFields(id, { status: 'approved' });
      await this.pullDetail(id);
      await this.refreshList();
      await this.estimates.appendRevision(id, 'Approved');
      this.historyRefresh.update((x) => x + 1);
      this.snackbar.success('Estimate approved and locked.');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Approve failed';
      this.snackbar.error(msg);
    } finally {
      this.approving = false;
    }
  }

  formatWhen(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  /**
   * Opens a print dialog so the user can save as PDF (browser “Save as PDF”).
   */
  exportPdf(): void {
    const d = this.detail();
    const id = this.selectedId();
    if (!d || !id) return;

    const title = this.title(d);
    const submitter = d.submitter?.full_name ?? '—';
    const client = this.headerClientName.trim() || d.client_name?.trim() || '—';
    const company = this.headerCompanyName.trim() || d.company_name?.trim() || '—';
    const status = d.status;
    const updated = this.formatWhen(d.updated_at);
    const margin = this.marginEdit;
    const sub = this.getSubtotal();
    const total = this.getTotalWithMargin();
    const marginAmt = sub * (Math.max(0, margin) / 100);

    const rows = this.detailLines
      .map((l) => {
        const amt = this.lineAmount(l);
        return `<tr>
          <td>${this.escapeHtml(l.resource_label || '—')}</td>
          <td class="num">${Number(l.hours)}</td>
          <td class="num">${Number(l.rate_per_hour)}</td>
          <td class="num">${amt.toFixed(2)}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111827; }
  h1 { font-size: 1.35rem; margin: 0 0 8px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; }
  th { background: #f8fafc; text-align: left; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 20px; max-width: 360px; margin-left: auto; font-size: 14px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .totals .row strong { font-size: 15px; }
  @media print { body { padding: 12px; } }
</style></head><body>
  <h1>Cost estimate</h1>
  <div class="meta">
    <strong>${this.escapeHtml(title)}</strong><br />
    Client: ${this.escapeHtml(client)} · Company: ${this.escapeHtml(company)}<br />
    Submitter: ${this.escapeHtml(submitter)} · Status: ${status} · Updated: ${updated}
  </div>
  <table>
    <thead>
      <tr>
        <th>Resource / role</th>
        <th class="num">Hours</th>
        <th class="num">Rate / hr</th>
        <th class="num">Line total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${sub.toFixed(2)}</span></div>
    <div class="row"><span>Margin (${margin}%)</span><span>${marginAmt.toFixed(2)}</span></div>
    <div class="row"><strong>Total with margin</strong><strong>${total.toFixed(2)}</strong></div>
  </div>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      this.snackbar.error('Allow pop-ups to export, then try Export PDF again.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
