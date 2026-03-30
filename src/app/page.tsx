import { VikcheDashboard } from "@/components/dashboard/vikche-dashboard";
import { getDashboardData } from "@/lib/watch-service";
import { getOptionalViewer } from "@/lib/viewer";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getOptionalViewer();

  if (!viewer) {
    redirect("/signin");
  }

  const dashboard = await getDashboardData(viewer.id);

  return (
    <VikcheDashboard
      initialData={dashboard}
      viewer={{
        name: viewer.name,
        email: viewer.email,
      }}
    />
  );
}
