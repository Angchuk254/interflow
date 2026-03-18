import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../../services/api';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  protected readonly api = inject(Api);
  protected readonly loginForm = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly passwordVisible = signal(false);
  protected readonly carouselImages = [
    'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=1200&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80',
  ];
  protected readonly activeSlide = signal(0);
  protected readonly deactivatedError = signal(false);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private carouselIntervalId?: ReturnType<typeof setInterval>;

  constructor() {
    void this.redirectIfAuthenticated();
  }

  ngOnInit(): void {
    // Check for deactivated account error
    const error = this.route.snapshot.queryParamMap.get('error');
    if (error === 'account_deactivated') {
      this.deactivatedError.set(true);
    }

    this.carouselIntervalId = setInterval(() => {
      this.nextSlide();
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.carouselIntervalId) {
      clearInterval(this.carouselIntervalId);
    }
  }

  protected async submit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.deactivatedError.set(false);
    const result = await this.api.signInWithPassword(this.loginForm.getRawValue());

    if (result.errorMessage) {
      return;
    }

    // Check profile status after login
    const profile = this.api.profile();
    
    if (profile?.status === 'deactivated') {
      await this.api.signOut();
      this.deactivatedError.set(true);
      return;
    }

    if (profile?.status === 'invited') {
      await this.router.navigate(['/accept-invite']);
      return;
    }

    await this.router.navigateByUrl(
      this.route.snapshot.queryParamMap.get('redirectTo') || '/dashboard',
    );
  }

  protected showError(controlName: 'email' | 'password'): boolean {
    const control = this.loginForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected setActiveSlide(index: number): void {
    this.activeSlide.set(index);
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  protected nextSlide(): void {
    this.activeSlide.update((index) => (index + 1) % this.carouselImages.length);
  }

  protected previousSlide(): void {
    this.activeSlide.update((index) =>
      index === 0 ? this.carouselImages.length - 1 : index - 1,
    );
  }

  private async redirectIfAuthenticated(): Promise<void> {
    await this.api.initialize();

    if (this.api.session()) {
      await this.router.navigate(['/dashboard']);
    }
  }
}
