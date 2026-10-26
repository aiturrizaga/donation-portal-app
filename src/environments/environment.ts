import { isDevMode } from '@angular/core';

export const environment = {
  production: !isDevMode(),
  apiUrl: import.meta.env.NG_APP_API_URL,
  support: {
    url: `mailto:${import.meta.env.NG_APP_SUPPORT_EMAIL}`,
  },
};
