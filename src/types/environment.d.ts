export interface EnvironmentConfig {
  // OpenAI
  OPENAI_API_KEY: string;

  // Server
  PORT?: string;

  // WeKnow API
  WEKNOW_API_HOST?: string;
  WEKNOW_API_PORT?: string;
  WEKNOW_ACCOUNT_TOKEN?: string;
  WEKNOW_PASSWORD_SALT?: string;

  // Metadata
  METADATA_ID?: string;

  // PostgreSQL (optional, for future use)
  PGHOST?: string;
  PGPORT?: string;
  PGDATABASE?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvironmentConfig {}
  }
}

export {};
