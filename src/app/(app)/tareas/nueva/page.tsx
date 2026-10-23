import { Encabezado } from "@/components/Etiquetas";
import { FormTarea } from "@/components/FormTarea";
import { listarAnalistas, listarClientesSimple } from "@/lib/consultas";

export const metadata = { title: "Nueva tarea" };

export default async function NuevaTarea({ searchParams }: { searchParams: Promise<{ cliente?: string; reunion?: string }> }) {
  const { cliente, reunion } = await searchParams;
  const [clientes, analistas] = await Promise.all([listarClientesSimple(), listarAnalistas()]);
  return (
    <div className="max-w-3xl">
      <Encabezado titulo="Nueva tarea" detalle={reunion ? `Se agrega a la reunión ${reunion}.` : "Una tarea que no salió de una minuta."} />
      <FormTarea clientes={clientes} analistas={analistas.filter((a) => a.activo)} clienteInicial={cliente} reunionId={reunion} />
    </div>
  );
}
