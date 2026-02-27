import { SolicitudesActivasCard } from "./_components/solicitudes-activas-card";
import { ContactosCard } from "./_components/contactos-card";
import { VisitasHoyCard } from "./_components/visitas-hoy-card";
import { UltimasSolicitudesCard } from "./_components/ultimas-solicitudes-card";
import { ActividadCard } from "./_components/actividad-card";
import { ProximasVisitasCard } from "./_components/proximas-visitas-card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: Hero stats */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <SolicitudesActivasCard />
        <div className="flex flex-col gap-5">
          <ContactosCard />
          <VisitasHoyCard />
        </div>
      </div>

      {/* Row 2: Lists */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_240px_320px]">
        <UltimasSolicitudesCard />
        <ActividadCard />
        <ProximasVisitasCard />
      </div>
    </div>
  );
}
