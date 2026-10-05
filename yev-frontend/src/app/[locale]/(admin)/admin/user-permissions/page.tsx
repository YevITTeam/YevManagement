import UserPermissionOverrideManager from "@/modules/auth/components/permissions/UserPermissionOverrideManager";
import { AdminPageGate } from "../../AdminAccessGuard";

export default function AdminUserPermissionsPage() {
  return (
    <AdminPageGate permission="Identity.Permission.View">
      <UserPermissionOverrideManager />
    </AdminPageGate>
  );
}
