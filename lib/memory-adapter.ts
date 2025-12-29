import type { Adapter } from "next-auth/adapters";

/**
 * Simple in-memory adapter for testing
 * WARNING: This stores data in memory only - data is lost on server restart
 * For production, use a real database adapter
 */

interface VerificationToken {
  identifier: string;
  token: string;
  expires: Date;
}

const verificationTokens: VerificationToken[] = [];

export function MemoryAdapter(): Adapter {
  return {
    async createVerificationToken(verificationToken) {
      verificationTokens.push(verificationToken);
      return verificationToken;
    },
    
    async useVerificationToken({ identifier, token }) {
      const index = verificationTokens.findIndex(
        (vt) => vt.identifier === identifier && vt.token === token
      );
      
      if (index === -1) {
        return null;
      }
      
      const verificationToken = verificationTokens[index];
      verificationTokens.splice(index, 1);
      
      return verificationToken;
    },

    // Minimal user methods for email provider
    async getUserByEmail() {
      // Not used - we validate users in signIn callback via Airtable
      return null;
    },

    async createUser(user: { email: string }) {
      // Return a minimal user object
      // Actual user data comes from Airtable via JWT callback
      return {
        id: crypto.randomUUID(),
        email: user.email,
        emailVerified: new Date(),
      };
    },
  };
}
