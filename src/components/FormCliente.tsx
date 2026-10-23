"use client";

import { useActionState, useState } from "react";
import { guardarCliente } from "@/app/acciones";
import { ESTADOS_CLIENTE, ETIQUETAS, type Cliente, type Contacto } from "@/db/schema";

function Campo({ nombre, etiqueta, valor, tipo = "text", placeholder }: { nombre: string; etiqueta: string; valor?: string | null; tipo?: string; placeholder?: string }) {
  return (
    <label className="block min-w-0">
      <span className="etiqueta-campo">{etiqueta}</span>
      <input id={nombre} name={nombre} type={tipo} defaultValue={valor ?? ""} placeholder={placeholder} className="campo" />
    </label>
  );
}

function Texto({ nombre, etiqueta, valor, placeholder }: { nombre: string; etiqueta: string; valor?: string | null; placeholder?: string }) {
  return (
    <label className="block min-w-0 sm:col-span-2">
      <span className="etiqueta-campo">{etiqueta}</span>
      <textarea id={nombre} name={nombre} defaultValue={valor ?? ""} placeholder={placeholder} rows={3} className="campo" />
    </label>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="panel p-5">
      <legend className="px-1 text-sm font-bold">{titulo}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function FormCliente({ cliente, accounts }: { cliente?: Cliente; accounts: string[] }) {
  const [estado, accion, guardando] = useActionState(guardarCliente, undefined);
  const [contactos, setContactos] = useState<Contacto[]>(cliente?.contactos.length ? cliente.contactos : [{ nombre: "" }]);

  return (
    <form action={accion} className="grid gap-5">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <Seccion titulo="Datos generales">
        <Campo nombre="nombre" etiqueta="Nombre del cliente *" valor={cliente?.nombre} />
        <label className="block">
          <span className="etiqueta-campo">Estado</span>
          <select id="estado" name="estado" defaultValue={cliente?.estado ?? "Activo"} className="campo">
            {ESTADOS_CLIENTE.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta-campo">Account a cargo</span>
          <input id="account" name="account" list="lista-accounts" defaultValue={cliente?.account ?? ""} className="campo" />
          <datalist id="lista-accounts">
            {accounts.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <Campo nombre="alias" etiqueta="Otros nombres (separados por coma)" valor={cliente?.alias.join(", ")} placeholder="Como aparece en minutas o en el sheet" />
      </Seccion>

      <Seccion titulo="Negocio">
        <Campo nombre="industria" etiqueta="Industria" valor={cliente?.industria} placeholder="Ej: Retail de indumentaria" />
        <Campo nombre="pais" etiqueta="País" valor={cliente?.pais} />
        <Campo nombre="sitioWeb" etiqueta="Sitio web" valor={cliente?.sitioWeb} tipo="url" placeholder="https://" />
        <Campo nombre="plataformaEcommerce" etiqueta="Plataforma e-commerce" valor={cliente?.plataformaEcommerce} placeholder="VTEX, Shopify, Magento…" />
        <Texto nombre="descripcionNegocio" etiqueta="Descripción del negocio" valor={cliente?.descripcionNegocio} placeholder="Qué vende, a quién, canales, temporadas fuertes" />
        <Texto nombre="objetivosNegocio" etiqueta="Objetivos del negocio" valor={cliente?.objetivosNegocio} placeholder="Qué espera lograr el cliente con Known" />
        <Texto nombre="competidores" etiqueta="Competidores" valor={cliente?.competidores} />
      </Seccion>

      <Seccion titulo="Servicio contratado">
        <div className="sm:col-span-2">
          <span className="etiqueta-campo">Servicios</span>
          <div className="flex flex-wrap gap-4">
            {ETIQUETAS.filter((e) => e !== "OTRO").map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input type="checkbox" name="servicios" value={s} defaultChecked={cliente?.servicios.includes(s)} className="accent-marca" />
                {s}
              </label>
            ))}
          </div>
        </div>
        <Campo nombre="feeMensual" etiqueta="Fee mensual" valor={cliente?.feeMensual} placeholder="Ej: USD 2.500" />
        <Campo nombre="fechaInicio" etiqueta="Cliente desde" valor={cliente?.fechaInicio} tipo="date" />
        <Campo nombre="frecuenciaReunion" etiqueta="Frecuencia de reunión" valor={cliente?.frecuenciaReunion} placeholder="Semanal, quincenal, mensual" />
      </Seccion>

      <fieldset className="panel p-5">
        <legend className="px-1 text-sm font-bold">Contactos del cliente</legend>
        <div className="grid gap-3">
          {contactos.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <input name="contacto_nombre" defaultValue={c.nombre} placeholder="Nombre" aria-label="Nombre del contacto" className="campo" />
              <input name="contacto_cargo" defaultValue={c.cargo} placeholder="Cargo" aria-label="Cargo" className="campo" />
              <input name="contacto_email" type="email" defaultValue={c.email} placeholder="Email" aria-label="Email" className="campo" />
              <input name="contacto_telefono" defaultValue={c.telefono} placeholder="Teléfono" aria-label="Teléfono" className="campo" />
              <button type="button" className="boton-secundario" onClick={() => setContactos(contactos.filter((_, j) => j !== i))} aria-label="Quitar contacto">
                Quitar
              </button>
            </div>
          ))}
          <button type="button" className="boton-secundario justify-self-start" onClick={() => setContactos([...contactos, { nombre: "" }])}>
            Agregar contacto
          </button>
        </div>
      </fieldset>

      <Seccion titulo="Integraciones">
        <Campo nombre="jiraProjectKey" etiqueta="Proyecto de Jira (key)" valor={cliente?.jiraProjectKey} placeholder="Ej: ATKMKT" />
        <Campo nombre="jiraProjectId" etiqueta="ID del proyecto de Jira" valor={cliente?.jiraProjectId} />
        <Campo nombre="jiraIssueType" etiqueta="Tipo de issue de Jira" valor={cliente?.jiraIssueType} />
        <Campo nombre="slackCanal" etiqueta="Canal de Slack" valor={cliente?.slackCanal} placeholder="https://app.slack.com/client/…" />
        <Campo nombre="trelloTablero" etiqueta="Tablero de Trello" valor={cliente?.trelloTablero} placeholder="https://trello.com/b/…" />
      </Seccion>

      <fieldset className="panel p-5">
        <legend className="px-1 text-sm font-bold">Notas</legend>
        <textarea id="notas" name="notas" defaultValue={cliente?.notas ?? ""} rows={4} className="campo" aria-label="Notas" />
      </fieldset>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-linea bg-fondo/95 py-3">
        <button className="boton" disabled={guardando}>
          {guardando ? "Guardando…" : cliente ? "Guardar ficha" : "Crear cliente"}
        </button>
        {estado?.error && <span className="text-sm text-critico">{estado.error}</span>}
        {estado?.ok && <span className="text-sm text-ok">{estado.ok}</span>}
      </div>
    </form>
  );
}
