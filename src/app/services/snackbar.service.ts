import { Injectable, inject, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class SnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly ngZone = inject(NgZone);

  /** Ensures the overlay runs inside Angular zone (Supabase and other SDK callbacks often resolve outside it). */
  private openInZone(
    message: string,
    duration: number,
    panelClass: string[],
  ): void {
    this.ngZone.run(() => {
      this.snackBar.open(message, 'Close', {
        duration,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass,
      });
    });
  }

  success(message: string, duration = 4000): void {
    this.openInZone(message, duration, ['snackbar-success']);
  }

  error(message: string, duration = 5000): void {
    this.openInZone(message, duration, ['snackbar-error']);
  }

  info(message: string, duration = 4000): void {
    this.openInZone(message, duration, ['snackbar-info']);
  }
}
