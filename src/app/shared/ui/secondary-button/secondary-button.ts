import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-secondary-button',
  templateUrl: './secondary-button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Sin esto, el host <app-secondary-button> es un elemento desconocido con
  // display inline por defecto — el w-full del <button> interno se estira
  // contra ESE host encogido, no contra el contenedor flex real, y el botón
  // termina angosto en vez de ocupar todo el ancho como "Ver mi certificado".
  host: { class: 'contents' },
})
export class SecondaryButton {}
