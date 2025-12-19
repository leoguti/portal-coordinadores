import NextAuth, { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { MemoryAdapter } from "@/lib/memory-adapter";
import { getCoordinatorByEmail } from "@/lib/airtable";

/**
 * NextAuth configuration for Email Magic Link authentication
 * 
 * This is a MINIMAL test setup:
 * - Uses Email provider with magic links
 * - No database (uses in-memory adapter for tokens)
 * - Uses Nodemailer SMTP for sending emails
 * - Validates email against Airtable Coordinadores table
 */
export const authOptions: NextAuthOptions = {
  // Use in-memory adapter for verification tokens
  adapter: MemoryAdapter(),
  
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
  
  // Callbacks for session handling and authorization
  callbacks: {
    async signIn({ user }) {
      // Deny sign-in if email is missing
      if (!user.email) {
        console.log("Sign-in denied: No email provided");
        return "/login?error=NoEmail";
      }

      // Check if user email exists in Airtable Coordinadores table
      const coordinator = await getCoordinatorByEmail(user.email);

      if (!coordinator) {
        console.log(`Sign-in denied: ${user.email} is not an authorized coordinator`);
        return "/login?error=NotCoordinator";
      }

      console.log(`Sign-in allowed for coordinator: ${coordinator.name} (${coordinator.email})`);
      return true;
    },

    async jwt({ token, user, account }) {
      // On sign-in (when account exists), fetch and store the Airtable record ID
      // This happens when the user clicks the magic link
      if (account && user?.email) {
        const coordinator = await getCoordinatorByEmail(user.email);
        if (coordinator) {
          token.coordinatorRecordId = coordinator.id;
          console.log(`JWT: Stored coordinator record ID ${coordinator.id} for ${user.email}`);
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      // Add user email and coordinatorRecordId to session
      if (token.email && session.user) {
        session.user.email = token.email;
      }
      if (token.coordinatorRecordId && session.user) {
        session.user.coordinatorRecordId = token.coordinatorRecordId;
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
