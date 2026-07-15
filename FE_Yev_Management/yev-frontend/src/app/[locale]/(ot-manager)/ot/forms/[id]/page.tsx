import OtFormDetail from "@/modules/attendance/components/ot-form/OtFormDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <OtFormDetail id={Number(id)} />;
}
