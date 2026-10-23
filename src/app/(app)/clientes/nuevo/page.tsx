import { Encabezado } from "@/components/Etiquetas";
import { FormCliente } from "@/components/FormCliente";
import { listarClientes } from "@/lib/consultas";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoCliente() {
  const clientes = await listarClientes();
  const accounts = [...new Set(clientes.map((c) => c.cliente.account).filter((a): a is string => !!a))].sort();
  return (
    <div className="max-w-4xl">
      <Encabezado titulo="Nuevo cliente" detalle="Completá lo que sepas: la ficha se puede terminar después." />
      <FormCliente accounts={accounts} />
    </div>
  );
}
