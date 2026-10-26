declare interface Env {
  readonly NODE_ENV: string;
  readonly NG_APP_ENV: string;
  readonly NG_APP_API_URL: string;
  readonly NG_APP_SUPPORT_EMAIL: string;

  [key: string]: any;
}

declare interface ImportMeta {
  readonly env: Env;
}
