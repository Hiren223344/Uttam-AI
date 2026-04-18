import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match these specifically to protect them:
     * 1. Homepage (/)
     * 2. Chat pages (/c/*)
     */
    "/",
    "/c/:path*"
  ],
};
