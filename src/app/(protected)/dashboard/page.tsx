import { DashboardOverviewClient } from "./_components/dashboard-overview-client";
import { ProximasFirmasCard } from "./_components/proximas-firmas-card";
import { CobrosMesCard } from "./_components/cobros-mes-card";
import { PanoramaCard } from "./_components/panorama-card";

export default async function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <PanoramaCard />
      <DashboardOverviewClient />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <CobrosMesCard />
        <ProximasFirmasCard />
      </div>
    </div>
  );
}
