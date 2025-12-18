import type { Adapter, AdapterUser } from "next-auth/adapters";

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

interface User extends AdapterUser {
  id: string;
  email: string;
  emailVerified: Date | null;
}

const verificationTokens: VerificationToken[] = [];
const users: User[] = [];

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
      
      if (index === -1) return null;
      
      const verificationToken = verificationTokens[index];
      verificationTokens.splice(index, 1);
      
      return verificationToken;
    },
    
    async getUserByEmail(email) {
      const user = users.find((u) => u.email === email);
      return user || null;
    },
    
    async createUser(userData) {
      const user: User = {
        id: crypto.randomUUID(),
        email: userData.email,
        emailVerified: new Date(),
        name: userData.name || null,
        image: userData.image || null,
      };
      users.push(user);
      return user;
    },
    
    async getUser(id) {
      const user = users.find((u) => u.id === id);
      return user || null;
    },
    
    async getUserByAccount({ providerAccountId, provider }) {
      // Not needed for email provider
      return null;
    },
    
    async updateUser(userData) {
      const index = users.findIndex((u) => u.id === userData.id);
      if (index === -1) throw new Error("User not found");
      
      users[index] = { ...users[index], ...userData };
      return users[index];
    },
    
    async deleteUser(userId) {
      const index = users.findIndex((u) => u.id === userId);
      if (index !== -1) {
        users.splice(index, 1);
      }
    },
    
    async linkAccount(account) {
      // Not needed for email provider
      return account;
    },
    
    async unlinkAccount({ providerAccountId, provider }) {
      // Not needed for email provider
    },
    
    async createSession(session) {
      // Sessions handled by JWT
      return session;
    },
    
    async getSessionAndUser(sessionToken) {
      // Sessions handled by JWT
      return null;
    },
    
    async updateSession(session) {
      // Sessions handled by JWT
      return session;
    },
    
    async deleteSession(sessionToken) {
      // Sessions handled by JWT
    },
  };
}
