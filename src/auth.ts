import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const DOMINIO = process.env.AUTH_DOMINIO || "knownonline.com";

declare module "next-auth" {
  interface Session {
    googleAccessToken?: string;
    googleExpira?: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      authorization: {
        params: {
          // Solo lectura de Docs (minutas) y Sheets (blueprints), con la cuenta de quien usa la plataforma.
          scope: "openid email profile https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/spreadsheets.readonly",
          hd: DOMINIO,
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const email = String(profile?.email ?? "").toLowerCase();
      return Boolean(profile?.email_verified) && email.endsWith("@" + DOMINIO);
    },
    jwt({ token, account }) {
      if (account) {
        token.googleAccessToken = account.access_token;
        token.googleExpira = account.expires_at;
      }
      return token;
    },
    session({ session, token }) {
      session.googleAccessToken = token.googleAccessToken as string | undefined;
      session.googleExpira = token.googleExpira as number | undefined;
      return session;
    },
  },
});
