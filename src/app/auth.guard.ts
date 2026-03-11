import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Api } from './services/api';

export const authGuard: CanActivateFn = async (_route, state) => {
  const api = inject(Api);
  const router = inject(Router);

  await api.initialize();

  if (!api.session()) {
    return router.createUrlTree(['/login'], {
      queryParams: { redirectTo: state.url },
    });
  }

  // Check if user profile is complete (not in 'invited' status)
  const profile = api.profile();
  if (profile?.status === 'invited') {
    return router.createUrlTree(['/accept-invite']);
  }

  // Check if user is deactivated
  if (profile?.status === 'deactivated') {
    await api.signOut();
    return router.createUrlTree(['/login'], {
      queryParams: { error: 'account_deactivated' },
    });
  }

  return true;
};
