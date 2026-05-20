import type { UserRole } from "@videoai/contracts";

export type ServicePrincipal = {
  userId: string;
  role: UserRole;
};

export function canAccessAdmin(principal: ServicePrincipal) {
  return principal.role === "admin";
}

export function canAccessOwnedResource(principal: ServicePrincipal, ownerUserId: string) {
  return principal.role === "admin" || principal.userId === ownerUserId;
}
