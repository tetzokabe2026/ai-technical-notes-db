import type { AppUser } from "@/lib/auth";

export const approvedUser: AppUser = {
  id: "user-1",
  auth_user_id: "auth-1",
  email: "user@example.com",
  user_id: "testuser",
  role: "user",
  status: "approved",
};

export const adminUser: AppUser = {
  id: "admin-1",
  auth_user_id: "auth-admin",
  email: "admin@example.com",
  user_id: "admin",
  role: "admin",
  status: "approved",
};
