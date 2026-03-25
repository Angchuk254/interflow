import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FinanceEstimateService } from '../../services/finance-estimate.service';
import type { FinanceEstimateRevision } from '../../interfaces/database.types';

@Component({
  selector: 'app-estimate-revision-history',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './estimate-revision-history.html',
  styleUrl: './estimate-revision-history.scss',
})
export class EstimateRevisionHistory {
  private readonly finance = inject(FinanceEstimateService);

  readonly estimateId = input<string | null>(null);
  /** Increment after a new revision is saved to reload the list. */
  readonly refreshToken = input(0);

  readonly revisions = signal<FinanceEstimateRevision[]>([]);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      const id = this.estimateId();
      this.refreshToken();
      if (id) {
        void this.load(id);
      } else {
        this.revisions.set([]);
      }
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.finance.listRevisions(id);
      this.revisions.set(rows);
    } catch {
      this.revisions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  formatWhen(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  revisionSubtotal(row: FinanceEstimateRevision): number {
    return (row.lines_snapshot ?? []).reduce((s, l) => s + (l.line_total ?? 0), 0);
  }

  totalWithMargin(row: FinanceEstimateRevision): number {
    const m = Math.max(0, Number(row.margin_percent));
    return this.revisionSubtotal(row) * (1 + m / 100);
  }
}
