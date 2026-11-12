import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/auth/access";
import { getFilterOptions, getOverview, getPeople, getProperties, getQuality, getSearches, resolveRange, type InsightFilters } from "@/lib/web/server/insights";
import { PageHeader } from "../_components/page-header";
import { InsightsFilters } from "./_components/insights-filters";
import { OverviewTab } from "./_components/overview-tab";
import { PeopleTab } from "./_components/people-tab";
import { PropertiesTab } from "./_components/properties-tab";
import { QualityTab } from "./_components/quality-tab";
import { SearchesTab } from "./_components/searches-tab";

export const metadata = { title: "Analítica web" };

const TABS = ["resumen", "propiedades", "busquedas", "personas", "calidad"] as const;
type Tab = (typeof TABS)[number];

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getCurrentAccess();
  if (!access?.isAdmin) redirect("/dashboard");

  const raw = await searchParams;
  const value = (key: string) => (typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined);
  const filters: InsightFilters = {
    desde: value("desde"),
    hasta: value("hasta"),
    dias: value("dias"),
    dispositivo: value("dispositivo"),
    canal: value("canal"),
    persona: value("persona"),
    op: value("op"),
    tipo: value("tipo"),
    zona: value("zona"),
  };
  const tab: Tab = TABS.includes(value("tab") as Tab) ? (value("tab") as Tab) : "resumen";
  const range = resolveRange(filters);
  const options = await getFilterOptions();

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 md:gap-5">
      <PageHeader title="Analítica web" subtitle={<>Lo que pasa en la web pública, del {range.label}. Sin bots ni personas del equipo.</>} />
      <InsightsFilters options={options} active={tab} />
      {tab === "resumen" && <OverviewTab data={await getOverview(filters, range)} rangeDays={range.days} />}
      {tab === "propiedades" && <PropertiesTab rows={await getProperties(filters, range)} />}
      {tab === "busquedas" && <SearchesTab data={await getSearches(filters, range)} />}
      {tab === "personas" && <PeopleTab rows={await getPeople(filters, range)} />}
      {tab === "calidad" && <QualityTab data={await getQuality(range)} />}
    </div>
  );
}
