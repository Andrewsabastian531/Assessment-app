/**
 * Google requires the redirect_uri on the token exchange to byte-match the one
 * used to start the flow, so both are derived from this single function.
 */
export function googleRedirectUri(request: Request): string {
  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) return configured;
  return new URL('/api/auth/google/callback', request.url).toString();
}

/** Human-readable messages for the ?error= codes the callback can redirect with. */
export const OAUTH_ERRORS: Record<string, string> = {
  'google-not-configured':
    'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.',
  'google-cancelled': 'Google sign-in was cancelled.',
  'google-missing-code': 'Google did not return an authorization code.',
  'google-bad-state': 'Sign-in session expired. Please try again.',
  'google-token-exchange-failed': 'Could not exchange the Google code for a token.',
  'google-exchange-rejected': 'The server rejected the Google sign-in.',
};
