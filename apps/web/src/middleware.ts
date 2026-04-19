export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    // Protect everything under /dashboard. Login/api routes remain public.
    '/dashboard/:path*',
  ],
};
