import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { catchError, of } from 'rxjs';
import { DonationApi } from '../../../donation/api/donation.api';
import { LegalPageApi } from '../../../donation/api/legal-page.api';
import { AccountApi } from '../../api/account.api';
import { AccountSessionService } from '../../services/account-session.service';
import { DonorAccount } from '../../models/account.model';
import { AccountLogin } from '../../components/account-login/account-login';
import { AccountDashboard } from '../../components/account-dashboard/account-dashboard';
import { PortalHeader } from '@shared/ui/portal-header/portal-header';
import { PortalFooter } from '@shared/ui/portal-footer/portal-footer';
import { Spinner } from '@shared/ui/spinner/spinner';
import { BrandThemeService } from '@core/services/brand-theme.service';
import { environment } from '@env/environment';

/**
 * /mi-cuenta — login del donante (correo + OTP) y sus donaciones. Toma el
 * branding, logo y footer de la organización del dominio (su página por
 * defecto), igual que el libro de reclamaciones.
 */
@Component({
  selector: 'app-account-page',
  imports: [AccountLogin, AccountDashboard, PortalHeader, PortalFooter, Spinner],
  templateUrl: './account-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  // ?email= — enlace "Ver mis donaciones" del correo de confirmación.
  protected readonly email = inject(ActivatedRoute).snapshot.queryParamMap.get('email');

  readonly #api = inject(AccountApi);
  readonly #session = inject(AccountSessionService);
  readonly #brandTheme = inject(BrandThemeService);

  protected readonly hostPage = toSignal(
    inject(DonationApi)
      .getDefaultPage()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );
  protected readonly legalPages = toSignal(
    inject(LegalPageApi)
      .getAll()
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly account = signal<DonorAccount | null>(null);
  // true mientras se valida una sesión guardada contra GET /me.
  protected readonly restoring = signal(this.#session.isLoggedIn());

  protected readonly orgName = computed(() => this.hostPage()?.organizationName ?? '');
  protected readonly logoUrl = computed(() => {
    const path = this.hostPage()?.branding?.logoUrl;
    return path ? `${environment.apiUrl}${path}` : null;
  });

  constructor() {
    inject(Title).setTitle('Mi cuenta');

    effect(() => {
      const page = this.hostPage();
      if (page) this.#brandTheme.applyIfUnset(page.branding?.primaryColor);
    });

    // Token vencido/revocado (el interceptor lo limpia ante un 401): volver
    // al login sin quedarse con datos de la cuenta en pantalla.
    effect(() => {
      if (!this.#session.isLoggedIn()) this.account.set(null);
    });

    if (this.restoring()) {
      this.#api.getMe().subscribe({
        next: (account) => {
          this.account.set(account);
          this.restoring.set(false);
        },
        error: () => this.restoring.set(false),
      });
    }
  }

  onLoggedIn(account: DonorAccount): void {
    this.account.set(account);
  }

  onLogout(): void {
    this.#api.logout().subscribe({ error: () => undefined });
    this.#session.clear();
    this.account.set(null);
  }
}
