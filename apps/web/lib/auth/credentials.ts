import { prisma, verifyPassword } from "@videoai/database";

export type AppRole = "user" | "admin";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export function getRoleLandingPath(role: AppRole) {
  return role === "admin" ? "/admin/ai-config" : "/dashboard";
}

export async function verifyCredentials(username: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.userProfile.findUnique({
    where: { username }
  });

  if (!user || user.status !== "active") {
    return null;
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return null;
  }

  return {
    id: user.id,
    name: user.displayName,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user"
  };
}
