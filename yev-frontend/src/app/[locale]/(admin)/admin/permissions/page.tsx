import RolePermissionManager from "@/modules/auth/components/permissions/RolePermissionManager";
import { AdminPageGate } from "../../AdminAccessGuard";

export default function AdminRolePermissionsPage() {
  return (
    <AdminPageGate permission="Identity.Permission.View">
      <RolePermissionManager />
    </AdminPageGate>
  );
}
