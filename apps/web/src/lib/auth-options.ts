import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';
import type { ProfilePayload, UserRole } from '@/types/auth';

// Server-side: ưu tiên INTERNAL_API_URL (docker network) để tránh NAT loopback khi
// public URL trỏ về cùng modem (vd POC trên local server với DDNS + port forward).
const BASE_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000/api/v1';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Decode JWT payload (no verify — backend verifies every request). */
function decodeJwt<T>(token: string): T | null {
  try {
    const [, payload] = token.split('.');
    const json = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

interface AccessPayload {
  sub: number;
  email: string;
  role: UserRole;
  exp: number;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
  try {
    const { data } = await axios.post<TokenPair>(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 10_000 },
    );
    return data;
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const { data: tokens } = await axios.post<TokenPair>(
            `${BASE_URL}/auth/login`,
            { email: credentials.email, password: credentials.password },
            { timeout: 10_000 },
          );
          // Fetch profile to get fullName, branchId
          const { data: profile } = await axios.get<ProfilePayload>(`${BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
            timeout: 10_000,
          });
          const payload = decodeJwt<AccessPayload>(tokens.accessToken);
          return {
            id: String(profile.id),
            email: profile.email,
            name: profile.fullName,
            fullName: profile.fullName,
            role: profile.role,
            branchId: profile.branchId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExp: payload?.exp,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in
        token.uid = Number(user.id);
        token.email = user.email;
        token.fullName = user.fullName;
        token.role = user.role;
        token.branchId = user.branchId;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExp = user.accessTokenExp;
        return token;
      }

      // Refresh access token ~30s before expiry
      const exp = token.accessTokenExp;
      if (exp && Date.now() / 1000 < exp - 30) return token;

      const refreshed = await refreshAccessToken(token.refreshToken);
      if (!refreshed) return { ...token, error: 'RefreshError' };
      const payload = decodeJwt<AccessPayload>(refreshed.accessToken);
      token.accessToken = refreshed.accessToken;
      token.refreshToken = refreshed.refreshToken;
      token.accessTokenExp = payload?.exp;
      token.error = undefined;
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.accessTokenExp = token.accessTokenExp;
      session.user = {
        id: token.uid,
        email: token.email,
        fullName: token.fullName,
        role: token.role,
        branchId: token.branchId,
      };
      return session;
    },
  },
};
