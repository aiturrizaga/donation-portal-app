import { createPageResolver } from './create-page-resolver';

export const defaultPageResolver = createPageResolver(
  (api) => api.getDefaultPage(),
  (err: any) => {
    const isNotConfigured = err.status === 422 || err.error?.detail?.reason === 'no_default_page';
    return isNotConfigured
      ? { status: 503, target: '/not-configured' }
      : { status: 404, target: '/not-found' };
  },
);
