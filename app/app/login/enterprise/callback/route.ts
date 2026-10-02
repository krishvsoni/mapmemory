import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { authorizationCodeGrant, getOidcConfig } from '@/lib/enterprise-sso';
import { setSession } from '@/lib/session';
import { ENTERPRISE_STATE_COOKIE } from '../constants';

interface StoredLoginState {
  issuer: string;
  audience: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const store = await cookies();
  const raw = store.get(ENTERPRISE_STATE_COOKIE)?.value;
  store.delete(ENTERPRISE_STATE_COOKIE);

  if (!raw) {
    return NextResponse.redirect(new URL('/login?error=enterprise_session_expired', request.url));
  }

  try {
    const { issuer, audience, state, nonce, codeVerifier } = JSON.parse(raw) as StoredLoginState;
    const config = await getOidcConfig(issuer, audience);
    const tokens = await authorizationCodeGrant(config, request, {
      expectedState: state,
      expectedNonce: nonce,
      pkceCodeVerifier: codeVerifier,
    });

    if (!tokens.id_token) throw new Error('Identity provider did not return an ID token');

    await setSession(tokens.id_token, 'enterprise workspace');
    return NextResponse.redirect(new URL('/spaces', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=enterprise_login_failed', request.url));
  }
}
