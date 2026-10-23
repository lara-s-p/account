export type Opcion = { valor: string; texto: string };

export const opcionesDe = (lista: readonly string[]): Opcion[] => lista.map((v) => ({ valor: v, texto: v }));
