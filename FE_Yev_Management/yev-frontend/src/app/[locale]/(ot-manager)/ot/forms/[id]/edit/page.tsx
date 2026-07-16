import CreateOtFormPage from "@/modules/attendance/components/ot-form/CreateOtFormPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <CreateOtFormPage otFormId={Number(id)} />;
}
