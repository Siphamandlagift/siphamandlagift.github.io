import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TENANT_API_CONFIG } from './tenant-api.config';
import { TenantAuthService } from './tenant-auth.service';

export const tenantAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(TenantAuthService);
  const config = inject(TENANT_API_CONFIG);
  const token = auth.token();

  if (!token || !request.url.startsWith(config.baseUrl)) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  }));
};