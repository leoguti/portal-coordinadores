import "next-auth";
import "next-auth/jwt";

/**
 * TypeScript module augmentation for NextAuth
 * 
 * Extends the default Session and JWT types to include
 * the Airtable coordinator record ID
 */

declare module "next-auth" {
  interface Session {
    user: {
      email?: string | null;
      coordinatorRecordId?: string; // Airtable record ID
    };
  }

  interface User {
    email?: string | null;
    coordinatorRecordId?: string; // Airtable record ID
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    email?: string | null;
    coordinatorRecordId?: string; // Airtable record ID
  }
}
