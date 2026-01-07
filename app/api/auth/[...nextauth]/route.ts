import NextAuth, { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { MemoryAdapter } from "@/lib/memory-adapter";
import { getCoordinatorByEmail } from "@/lib/airtable";

/**
 * Funciones para generar el contenido del email
 */
function text({ url, host, email }: { url: string; host: string; email: string }) {
  return `Portal CampoLimpio - Magic Link

Solicitud de acceso para: ${email}

Haz clic en el siguiente enlace para iniciar sesión:
${url}

Si no solicitaste este acceso, ignora este mensaje.

---
Portal Coordinadores CampoLimpio
${host}
`;
}

function html({ url, host, email }: { url: string; host: string; email: string }) {
  const escapedHost = host.replace(/\./g, "&#8203;.");
  const escapedEmail = email.replace(/\./g, "&#8203;.");
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Portal CampoLimpio</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Acceso al Portal de Coordinadores</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Se ha solicitado acceso al portal para:
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #92400e; font-size: 16px;">${escapedEmail}</strong>
              </div>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Haz clic en el botón de abajo para iniciar sesión:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${url}" style="background-color: #f97316; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                      🔓 Iniciar Sesión
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                O copia y pega este enlace en tu navegador:
              </p>
              <div style="background-color: #f3f4f6; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 12px; color: #4b5563;">
                ${url}
              </div>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 30px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                ⚠️ Si no solicitaste este acceso, puedes ignorar este mensaje de forma segura.
                <br><br>
                Este enlace expira en 24 horas.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Portal Coordinadores CampoLimpio<br>
                <span style="color: #9ca3af;">${escapedHost}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

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
        secure: Number(process.env.EMAIL_SERVER_PORT) === 465, // SSL para puerto 465
      },
      from: process.env.EMAIL_FROM,
      // Magic link token expires in 24 hours
      maxAge: 24 * 60 * 60,
      // Override: enviar TODOS los emails a administrativa@campolimpio.org
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const actualEmail = identifier; // Email del coordinador
        const overrideEmail = process.env.EMAIL_TO_OVERRIDE || identifier;
        const ccEmail = process.env.EMAIL_CC || null;
        
        console.log(`📧 Magic link solicitado para: ${actualEmail}`);
        console.log(`📧 Enviando a: ${overrideEmail}`);
        if (ccEmail) console.log(`📧 CC a: ${ccEmail}`);
        console.log(`🔗 Magic link: ${url}`);
        
        // Usar nodemailer para enviar
        const nodemailer = await import('nodemailer');
        const transport = nodemailer.default.createTransport(provider.server);
        
        const mailOptions: any = {
          to: overrideEmail, // SIEMPRE enviar a administrativa@
          from: provider.from,
          subject: `Login Portal CampoLimpio - ${actualEmail}`,
          text: text({ url, host: new URL(url).host, email: actualEmail }),
          html: html({ url, host: new URL(url).host, email: actualEmail }),
        };
        
        // Agregar CC si está configurado
        if (ccEmail) {
          mailOptions.cc = ccEmail;
        }
        
        await transport.sendMail(mailOptions);
        
        console.log(`✅ Email enviado a ${overrideEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''}`);
      },
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
          token.name = coordinator.name;
          token.rol = coordinator.rol;
          console.log(`JWT: Stored coordinator record ID ${coordinator.id} (${coordinator.rol}) for ${user.email}`);
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      // Add user email, name, coordinatorRecordId and rol to session
      if (token.email && session.user) {
        session.user.email = token.email;
      }
      if (token.name && session.user) {
        session.user.name = token.name;
      }
      if (token.coordinatorRecordId && session.user) {
        session.user.coordinatorRecordId = token.coordinatorRecordId;
      }
      if (token.rol && session.user) {
        session.user.rol = token.rol;
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
