import { createPageResolver } from './create-page-resolver';

export const donationPageResolver = createPageResolver(
  (api, route) => api.getPage(route.paramMap.get('slug')!),
  () => ({ status: 404, target: '/not-found' }),
);
