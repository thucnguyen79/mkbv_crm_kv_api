import type { DefaultSession, DefaultUser } from 'next-auth';

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface ProfilePayload {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  branchId?: number | null;
}

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken: string;
    refreshToken: string;
    accessTokenExp?: number; // epoch seconds
    user: ProfilePayload;
  }

  interface User extends DefaultUser {
    id: string; // NextAuth requires string
    email: string;
    fullName: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
    accessTokenExp?: number;
    branchId?: number | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: number;
    email: string;
    role: UserRole;
    fullName: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExp?: number;
    error?: 'RefreshError';
    branchId?: number | null;
  }
}
