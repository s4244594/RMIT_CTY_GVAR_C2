import { withAuth } from "@/lib/auth/middleware";
import { handle, resolveCaller } from "@/lib/caller";

// Who am I, as the server sees it. Also refreshes the stored copy of the caller's own name.
export const GET = withAuth(async (_req, jwt) =>
  handle(async () => {
    const me = await resolveCaller(jwt);
    return Response.json({
      id: me.id,
      username: me.username,
      role: me.role,
      firstName: me.firstName,
      lastName: me.lastName,
    });
  }),
);
