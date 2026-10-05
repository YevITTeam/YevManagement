import RoleList from "@/modules/auth/components/roles/RoleList";
import { AdminPageGate } from "../../AdminAccessGuard";

export default function AdminRolesPage() {
  return (
    <AdminPageGate permission="Identity.Role.View">
      <RoleList />
    </AdminPageGate>
  );
}
