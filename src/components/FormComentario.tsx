"use client";

import { useActionState, useEffect, useRef } from "react";
import { comentarTarea } from "@/app/acciones";

export function FormComentario({ tareaId }: { tareaId: string }) {
  const [estado, accion, enviando] = useActionState(comentarTarea, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={accion} className="grid gap-2">
      <input type="hidden" name="id" value={tareaId} />
      <textarea id="comentario" name="comentario" rows={2} placeholder="Agregá un avance, un bloqueo o una nota" aria-label="Comentario" className="campo" />
      <div className="flex items-center gap-3">
        <button className="boton-secundario" disabled={enviando}>
          {enviando ? "Guardando…" : "Comentar"}
        </button>
        {estado?.error && <span className="text-sm text-critico">{estado.error}</span>}
      </div>
    </form>
  );
}
