import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-secondary-button',
  templateUrl: './secondary-button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecondaryButton {}
