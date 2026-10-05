import UserRoleModal from "@/modules/auth/components/UserRoleModal";
import { AdminPageGate } from "../../AdminAccessGuard";

export default function AdminUserRolesPage() {
  return (
    <AdminPageGate permission="Identity.User.View">
      <UserRoleModal isOpen />
    </AdminPageGate>
  );
}
