import { AbstractControl } from '@angular/forms';

/**
 * Maps a control's active validation error to user-facing copy.
 * Returns null while the control is valid, or untouched/pristine — errors
 * should only surface after the user has interacted with the field.
 */
export function getFieldError(control: AbstractControl | null): string | null {
  if (!control || !control.invalid || !(control.touched || control.dirty)) return null;

  if (control.hasError('required') || control.hasError('requiredTrue')) {
    return 'Este campo es obligatorio.';
  }
  if (control.hasError('email')) {
    return 'Ingresa un correo válido.';
  }
  if (control.hasError('minlength')) {
    const { requiredLength } = control.getError('minlength');
    return `Ingresa al menos ${requiredLength} caracteres.`;
  }

  return 'Este campo no es válido.';
}
