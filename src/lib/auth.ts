import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google"
import prisma from "@/lib/prisma";
import { NextAuthOptions } from "next-auth";

export const authOptions:NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        {
            id: "frenix",
            name: "Frenix",
            type: "oauth",
            version: "2.0",
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            authorization: {
                url: "https://www.frenix.sh/oauth/authorize",
                params: { scope: "email profile" }
            },
            token: {
                url: "https://www.frenix.sh/api/oauth/token",
                async request({ provider, params, checks }) {
                    const response = await fetch(provider.token?.url as string, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            Authorization: `Basic ${Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString("base64")}`
                        },
                        body: new URLSearchParams({
                            grant_type: "authorization_code",
                            code: params.code!,
                            redirect_uri: provider.callbackUrl as string,
                            code_verifier: checks.code_verifier!,
                            client_id: provider.clientId as string,
                            client_secret: provider.clientSecret as string,
                        })
                    });
                    
                    if (!response.ok) {
                        const errorBody = await response.text();
                        console.error("[FRENIX_AUTH_ERROR]", response.status, errorBody);
                        throw new Error(`Failed to fetch tokens: ${response.status} ${errorBody}`);
                    }
                    return { tokens: await response.json() };
                }
            },
            userinfo: "https://www.frenix.sh/api/oauth/user",
            idToken: false,
            wellKnown: null,
            profile(profile) {
                const userMeta = profile.user_metadata || {};
                return {
                    id: String(profile.id),
                    name: userMeta.full_name || userMeta.name || profile.email,
                    email: profile.email,
                    image: userMeta.avatar_url || userMeta.picture,
                };
            },
            checks: ["pkce", "state"],
            allowDangerousEmailAccountLinking: true,
        }
    ],
    client: {
        idTokenSignedResponseAlg: "HS256", // dummy alg to prevent OIDC errors in some versions
    },
    session: {
        strategy: "jwt"
    },
    callbacks: {
        async jwt({ token, user, profile }: any) {
            if (user) {
                token.id = user.id;
            }
            if (profile) {
                // If it's a Frenix login, we might have more fields
                const userMeta = (profile as any).user_metadata || {};
                token.firstName = userMeta.first_name || profile.given_name;
                token.lastName = userMeta.last_name || profile.family_name;
                token.username = userMeta.username || profile.preferred_username;
            }
            return token;
        },
        async session({ session, token }: any) {
            if (token) {
                session.user.id = token.id as string;
                session.user.firstName = token.firstName as string;
                session.user.lastName = token.lastName as string;
                session.user.username = token.username as string;
            }

            return session;
        },
    },

    secret: process.env.NEXTAUTH_SECRET

}

