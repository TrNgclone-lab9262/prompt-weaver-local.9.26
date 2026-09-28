import { useEffect, useState } from "react";
import { localDB, type Role, type UserProfile } from "@/lib/local-db";

export function useSession() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => localDB.getCurrentUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCurrentUser(localDB.getCurrentUser());
  }, []);

  const session = currentUser
    ? {
        user: {
          id: currentUser.id,
          email: currentUser.email,
          user_metadata: {
            full_name: currentUser.full_name,
            role: currentUser.role,
          },
        },
      }
    : null;

  return { session, loading, currentUser };
}

export function useRole() {
  const { session, loading, currentUser } = useSession();
  const userId = session?.user.id;
  const role: Role = currentUser?.role || "admin";

  return {
    session,
    userId,
    role,
    isManager: role === "admin" || role === "leader",
    isAdmin: role === "admin",
    loading,
  };
}
