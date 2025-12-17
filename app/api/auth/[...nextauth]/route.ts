import NextAuth, { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";

/**
 * NextAuth configuration for Email Magic Link authentication
 * 
 * This is a MINIMAL test setup:
 * - Uses Email provider with magic links
 * - No database (sessions stored in JWT)
 * - Uses Nodemailer SMTP for sending emails
 */
export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      // Magic link token expires in 24 hours
      maxAge: 24 * 60 * 60,
    }),
  ],
  
  // Use JWT strategy (no database required)
  session: {
    strategy: "jwt",
  },
  
  // Custom pages
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/login",
  },
  
  // Callbacks for session handling
  callbacks: {
    async session({ session, token }) {
      // Add user email to session
      if (token.email && session.user) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  
  // Security settings
  secret: process.env.NEXTAUTH_SECRET,
};

// Export handlers for Next.js App Router
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
