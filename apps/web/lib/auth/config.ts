import type { NextAuthOptions, User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { query } from "../db/client";

type DbUserRow = {
  id: string;
  email: string;
  name: string | null;
};

async function findOrCreateDemoUser(): Promise<DbUserRow> {
  const email = "demo@acmecreator.test";

  const existing = await query<DbUserRow>(
    `select id, email, name from public.users where email = $1 limit 1`,
    [email]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await query<DbUserRow>(
    `
      insert into public.users (email, name)
      values ($1, $2)
      returning id, email, name
    `,
    [email, "Demo User"]
  );

  return inserted.rows[0];
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Demo",
      credentials: {
        code: {
          label: "Access code",
          type: "password",
          placeholder: "demo"
        }
      },
      async authorize(credentials) {
        if (!credentials?.code || credentials.code !== "demo") {
          return null;
        }

        const user = await findOrCreateDemoUser();

        const nextAuthUser: User = {
          id: user.id,
          email: user.email,
          name: user.name ?? "Demo User"
        };

        return nextAuthUser;
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as User).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = String(token.userId);
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
};

