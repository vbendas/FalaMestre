import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getLogger } from './request-context';

/**
 * NextAuth's own output, routed through the structured logger.
 *
 * Left to itself it writes multi-line, prefixed plain text straight to the
 * console — eleven lines and a stack for a missing secret — with no request
 * ID and nothing a JSON log drain can parse. It writes those lines while
 * serving a request, too, and in the missing-secret case they hold the only
 * copy of the actual cause: the route's own line says no more than that
 * there is a problem with the server configuration. So they go through
 * `getLogger`, which stamps them with the request that provoked them when
 * there is one and marks them unowned when there is not.
 *
 * `code` is NextAuth's own identifier (NO_SECRET, JWT_SESSION_ERROR). The
 * metadata is passed through as fields rather than interpolated, so the
 * logger's own serialiser decides how to render an error in it.
 */
const authLog = () => getLogger('next-auth');

const logger: NextAuthOptions['logger'] = {
  error(code, metadata) {
    authLog().error('NextAuth error', { code, metadata });
  },
  warn(code) {
    authLog().warn('NextAuth warning', { code });
  },
  debug(code, metadata) {
    authLog().debug('NextAuth debug', { code, metadata });
  },
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  logger,
};

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
