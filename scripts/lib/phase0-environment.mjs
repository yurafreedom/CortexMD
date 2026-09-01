export const PHASE0_ENVIRONMENT = Object.freeze({
  NEXT_TELEMETRY_DISABLED: '1',
  ADMIN_SESSION_SECRET: 'phase0-ci-only-not-a-production-secret-0001',
  ADMIN_PASSWORD: 'phase0-admin-password',
  NEXT_PUBLIC_SUPABASE_URL: 'https://phase0.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'phase0-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'phase0-service-role-key',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
  ANTHROPIC_API_KEY: '',
  WHOOP_CLIENT_ID: 'phase0-whoop-client-id',
  WHOOP_CLIENT_SECRET: 'phase0-whoop-client-secret',
});

export function phase0Environment(base = process.env) {
  return { ...base, ...PHASE0_ENVIRONMENT };
}
