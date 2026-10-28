import { DOCUMENT } from '@angular/common';
import { inject, Injectable, RendererFactory2, RendererStyleFlags2 } from '@angular/core';

const DEFAULT_PRIMARY = '#10b981';
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Aplica el color primario del branding de la página (admin → Páginas →
 * Branding) como variables CSS en <html> — de ahí cuelga la paleta `brand-*`
 * definida en tailwind.css. Se escribe con el Renderer para que también quede
 * en el HTML que genera el SSR (sin parpadeo del verde por defecto).
 */
@Injectable({ providedIn: 'root' })
export class BrandThemeService {
  readonly #document = inject(DOCUMENT);
  readonly #renderer = inject(RendererFactory2).createRenderer(null, null);

  #applied = false;

  apply(primaryColor: string | null | undefined): void {
    this.#applied = true;
    const primary = normalizeHex(primaryColor) ?? DEFAULT_PRIMARY;
    const root = this.#document.documentElement;
    this.#renderer.setStyle(root, '--brand', primary, RendererStyleFlags2.DashCase);
    this.#renderer.setStyle(
      root,
      '--brand-contrast',
      contrastColor(primary),
      RendererStyleFlags2.DashCase,
    );
  }

  /**
   * Para páginas sin branding propio (libro de reclamaciones): aplica el
   * color solo si ninguna landing lo hizo antes en esta sesión — si el
   * donante llegó desde /:slug, se respeta el color de esa página.
   */
  applyIfUnset(primaryColor: string | null | undefined): void {
    if (!this.#applied) this.apply(primaryColor);
  }
}

function normalizeHex(value: string | null | undefined): string | null {
  const color = value?.trim() ?? '';
  if (!HEX_COLOR.test(color)) return null;
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }
  return color.toLowerCase();
}

// Texto sobre fondos `bg-brand-500` (botones): blanco salvo que el primario
// sea muy claro (amarillo, lima, celeste pálido), donde el blanco sería
// ilegible. El umbral deja en blanco los tonos medios (emerald, azul, rojo,
// rosa), que es como siempre se vio el formulario.
function contrastColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? '#111827' : '#ffffff';
}
