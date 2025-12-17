# Email Magic Link Authentication Setup

## Overview

This project implements a **minimal test authentication** using NextAuth.js with Email Magic Links. This is designed for **testing purposes only** and does not include database connections, roles, or permissions.

## What's Included

- ✅ Email Magic Link authentication (passwordless)
- ✅ Login page (`/login`)
- ✅ Protected Dashboard page (`/dashboard`)
- ✅ Email verification page (`/verify-request`)
- ✅ Session management with JWT (no database)
- ✅ SMTP email sending with Nodemailer
- ✅ TypeScript support
- ✅ App Router compatible

## Files Created

```
app/
├── api/
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts          # NextAuth configuration
├── login/
│   └── page.tsx                  # Login form
├── dashboard/
│   └── page.tsx                  # Protected page
├── verify-request/
│   └── page.tsx                  # Email sent confirmation
├── providers.tsx                 # SessionProvider wrapper
└── layout.tsx                    # Updated with AuthProvider

.env.example                      # Environment variables template
```

## Setup Instructions

### 1. Install Dependencies

Already installed:
- `next-auth` - Authentication framework
- `nodemailer` - Email sending
- `@types/nodemailer` - TypeScript types

### 2. Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env.local
```

### 3. Generate NextAuth Secret

```bash
openssl rand -base64 32
```

Copy the output and paste it in `.env.local` as `NEXTAUTH_SECRET`.

### 4. Configure Email Provider

Choose one of these options for testing:

#### Option A: Mailtrap (Recommended for Testing)

1. Sign up at [mailtrap.io](https://mailtrap.io)
2. Get SMTP credentials from your inbox
3. Update `.env.local`:

```env
EMAIL_SERVER_HOST=smtp.mailtrap.io
EMAIL_SERVER_PORT=2525
EMAIL_SERVER_USER=your-mailtrap-username
EMAIL_SERVER_PASSWORD=your-mailtrap-password
EMAIL_FROM=test@example.com
```

#### Option B: Gmail (Quick Testing)

1. Enable 2FA in your Google account
2. Generate an App Password: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Update `.env.local`:

```env
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

#### Option C: SendGrid (Production-Ready)

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key
3. Update `.env.local`:

```env
EMAIL_SERVER_HOST=smtp.sendgrid.net
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=apikey
EMAIL_SERVER_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### 5. Complete .env.local Example

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generated-secret-here
EMAIL_SERVER_HOST=smtp.mailtrap.io
EMAIL_SERVER_PORT=2525
EMAIL_SERVER_USER=your-username
EMAIL_SERVER_PASSWORD=your-password
EMAIL_FROM=test@example.com
```

### 6. Start the Development Server

```bash
npm run dev
```

## Testing the Flow

1. **Visit the login page**: [http://localhost:3000/login](http://localhost:3000/login)

2. **Enter your email** and click "Enviar enlace mágico"

3. **Check your email** (or Mailtrap inbox) for the magic link

4. **Click the link** in the email

5. **You'll be redirected** to `/dashboard` showing your email

6. **Sign out** using the "Cerrar Sesión" button

## How It Works

### Authentication Flow

```
User enters email → NextAuth sends magic link → User clicks link → 
Session created → Redirected to dashboard
```

### Key Components

#### 1. NextAuth API Route (`app/api/auth/[...nextauth]/route.ts`)

- Configures Email provider
- Sets up JWT session strategy (no database)
- Defines custom pages
- Handles authentication callbacks

#### 2. Login Page (`app/login/page.tsx`)

- Client component with email input form
- Calls `signIn("email")` to send magic link
- Shows success/error messages
- Redirects to `/verify-request` on success

#### 3. Dashboard Page (`app/dashboard/page.tsx`)

- Protected route (requires authentication)
- Uses `useSession()` hook to get user data
- Redirects to `/login` if not authenticated
- Shows user email and sign out button

#### 4. Session Provider (`app/providers.tsx`)

- Wraps the app with `SessionProvider`
- Enables client-side session management
- Must be a Client Component

## Important Notes

### 🔒 Security

- This is a **TEST SETUP ONLY**
- No database = sessions lost on server restart
- Magic links expire after 24 hours
- Always use HTTPS in production
- Never commit `.env.local` to Git

### 📝 Limitations

- **No database**: Sessions are stored in JWT only
- **No roles**: All authenticated users have the same access
- **No permissions**: No fine-grained access control
- **No user management**: Can't list or manage users
- **Minimal error handling**: Production would need better error handling

### 🚀 Next Steps for Production

If you want to use this in production, you would need:

1. **Add a database** (PostgreSQL, MySQL, MongoDB)
2. **Install an adapter** (Prisma, TypeORM, etc.)
3. **Implement roles and permissions**
4. **Add proper error handling**
5. **Set up email templates**
6. **Configure production SMTP service**
7. **Add rate limiting**
8. **Implement session management**

## Troubleshooting

### "Configuration error"

- Check that all environment variables are set in `.env.local`
- Verify `NEXTAUTH_SECRET` is generated and set
- Restart the development server after changing `.env.local`

### "Error sending email"

- Verify SMTP credentials are correct
- Check that email provider allows SMTP access
- For Gmail, ensure you're using an App Password, not your regular password
- Test SMTP credentials using a tool like [https://www.smtper.net/](https://www.smtper.net/)

### "Session not found" or redirect loop

- Clear browser cookies
- Check that `NEXTAUTH_URL` matches your development URL
- Verify `SessionProvider` is wrapping the app in `layout.tsx`

### Magic link doesn't work

- Check email spam folder
- Verify link hasn't expired (24 hours)
- Ensure the link domain matches `NEXTAUTH_URL`

## Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Email Provider Docs](https://next-auth.js.org/providers/email)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Next.js App Router](https://nextjs.org/docs/app)

## Support

This is a minimal test setup for learning purposes. For production use, consult the official NextAuth.js documentation and consider professional security review.
