import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  // La sesión del donante vive en el storage del navegador — no hay nada
  // que renderizar en el servidor para esta ruta.
  { path: 'mi-cuenta', renderMode: RenderMode.Client },
  { path: ':slug', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server },
];
