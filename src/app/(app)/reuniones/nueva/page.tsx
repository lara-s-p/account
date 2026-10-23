import { Encabezado } from "@/components/Etiquetas";
import { FormReunion } from "@/components/FormReunion";
import { listarClientesSimple } from "@/lib/consultas";
import { hoyISO } from "@/lib/fechas";

export const metadata = { title: "Cargar minuta" };
// El procesamiento con Claude puede tardar: se amplía el tiempo máximo de la función en Vercel.
export const maxDuration = 300;

export default async function NuevaReunion({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const clientes = (await listarClientesSimple()).filter((c) => c.estado !== "Baja");
  return (
    <div className="max-w-3xl">
      <Encabezado
        titulo="Cargar minuta"
        detalle="Claude lee la minuta y propone las tareas con responsable, etiqueta, prioridad y fecha límite. Después las revisás y decidís cuáles se cargan."
      />
      <FormReunion clientes={clientes} clienteInicial={cliente} hoy={hoyISO()} />
    </div>
  );
}
