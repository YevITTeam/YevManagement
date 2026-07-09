import DeviceDetail from "@/modules/pc-management/components/devices/DeviceDetail";

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <DeviceDetail deviceId={Number(id)} />;
}
