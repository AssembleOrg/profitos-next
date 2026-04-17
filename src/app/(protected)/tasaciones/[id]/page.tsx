import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { TasacionForm } from "./_components/tasacion-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TasacionEditPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const tasacion = await prisma.tasacion.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, address: true } },
    },
  });

  if (!tasacion) redirect("/tasaciones");
  if (user.role !== "admin" && tasacion.userId !== user.id) redirect("/tasaciones");

  const serialized = {
    id: tasacion.id,
    titulo: tasacion.titulo,
    direccion: tasacion.direccion,
    ubicacionUnidad: tasacion.ubicacionUnidad,
    superficieTotal: tasacion.superficieTotal,
    superficieMono: tasacion.superficieMono,
    condicionVenta: tasacion.condicionVenta,
    mapaImageUrl: tasacion.mapaImageUrl,
    fotos: (tasacion.fotos as string[]) ?? [],
    informeHtml: tasacion.informeHtml,
    resultadoHtml: tasacion.resultadoHtml,
    listaPreciosTitulo: tasacion.listaPreciosTitulo,
    tablas: (tasacion.tablas as Array<{ titulo: string; filas: Array<{ unidad: string; valor: string; observaciones: string }> }>) ?? [],
    status: tasacion.status,
    createdAt: tasacion.createdAt.toISOString(),
  };

  return <TasacionForm tasacion={serialized} />;
}
