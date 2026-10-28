import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AccountApi } from '../../api/account.api';
import {
  AccountDonation,
  AccountOrganization,
  AccountSubscription,
  DONATION_STATUS_LABELS,
  DonorAccount,
  SUBSCRIPTION_STATUS_LABELS,
} from '../../models/account.model';
import { AccountEmails } from '../account-emails/account-emails';
import { InlineError } from '@shared/ui/inline-error/inline-error';
import { Spinner } from '@shared/ui/spinner/spinner';
import { getCurrencySymbol } from '@shared/utils/currency.util';

const PAGE_SIZE = 10;

const STATUS_TONE: Record<AccountDonation['status'], string> = {
  completed: 'text-brand-700 bg-brand-50',
  pending: 'text-amber-700 bg-amber-50',
  processing: 'text-amber-700 bg-amber-50',
  failed: 'text-red-600 bg-red-50',
  refunded: 'text-gray-600 bg-gray-100',
  expired: 'text-gray-600 bg-gray-100',
  cancelled: 'text-gray-600 bg-gray-100',
};

@Component({
  selector: 'app-account-dashboard',
  imports: [AccountEmails, InlineError, Spinner, DatePipe, DecimalPipe],
  templateUrl: './account-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDashboard {
  readonly account = input.required<DonorAccount>();
  // Organización del dominio actual — su grupo va primero en el filtro.
  readonly hostOrganizationName = input<string>('');
  readonly accountChange = output<DonorAccount>();
  readonly logout = output<void>();

  readonly #api = inject(AccountApi);

  protected readonly organizations = signal<AccountOrganization[]>([]);
  protected readonly selectedOrganizationId = signal<number | null>(null);
  protected readonly donations = signal<AccountDonation[]>([]);
  protected readonly donationsPage = signal(1);
  protected readonly donationsPages = signal(0);
  protected readonly donationsTotal = signal(0);
  protected readonly loadingDonations = signal(false);
  protected readonly donationsError = signal(false);
  protected readonly subscriptions = signal<AccountSubscription[]>([]);
  protected readonly downloadingId = signal<string | null>(null);

  protected readonly greeting = computed(() => {
    const name = this.account().displayName?.trim();
    return name ? `Hola, ${name.split(/\s+/)[0]}` : 'Hola';
  });
  protected readonly sortedOrganizations = computed(() => {
    const host = this.hostOrganizationName().toLowerCase();
    return [...this.organizations()].sort((a, b) =>
      a.name.toLowerCase() === host
        ? -1
        : b.name.toLowerCase() === host
          ? 1
          : a.name.localeCompare(b.name),
    );
  });
  protected readonly hasMore = computed(() => this.donationsPage() < this.donationsPages());
  protected readonly activeSubscriptions = computed(() =>
    this.subscriptions().filter((s) => s.status !== 'cancelled'),
  );

  protected readonly statusLabels = DONATION_STATUS_LABELS;
  protected readonly statusTone = STATUS_TONE;
  protected readonly subscriptionStatusLabels = SUBSCRIPTION_STATUS_LABELS;
  protected readonly getCurrencySymbol = getCurrencySymbol;

  constructor() {
    // Se recarga todo cuando cambian los correos de la cuenta (al vincular o
    // quitar uno cambian las donaciones visibles).
    effect(() => {
      this.account()
        .emails.map((e) => e.email)
        .join(',');
      untracked(() => this.#reloadAll());
    });
  }

  selectOrganization(id: number | null): void {
    if (this.selectedOrganizationId() === id) return;
    this.selectedOrganizationId.set(id);
    this.#loadDonations(1);
  }

  loadMore(): void {
    if (this.loadingDonations() || !this.hasMore()) return;
    this.#loadDonations(this.donationsPage() + 1);
  }

  retry(): void {
    this.#loadDonations(1);
  }

  async downloadCertificate(donation: AccountDonation): Promise<void> {
    const certificate = donation.certificate;
    if (!certificate || this.downloadingId()) return;
    this.downloadingId.set(donation.id);
    try {
      const blob = await firstValueFrom(this.#api.downloadCertificate(certificate.fileUrl));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certificate.certificateNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar el certificado. Inténtalo de nuevo.');
    } finally {
      this.downloadingId.set(null);
    }
  }

  #reloadAll(): void {
    this.#api.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations.set(orgs);
        const selected = this.selectedOrganizationId();
        if (selected && !orgs.some((o) => o.id === selected)) this.selectedOrganizationId.set(null);
        this.#loadDonations(1);
      },
      error: () => this.#loadDonations(1),
    });
    this.#api.getSubscriptions().subscribe({
      next: (subs) => this.subscriptions.set(subs),
      error: () => this.subscriptions.set([]),
    });
  }

  #loadDonations(page: number): void {
    this.loadingDonations.set(true);
    this.donationsError.set(false);
    this.#api.getDonations(page, PAGE_SIZE, this.selectedOrganizationId()).subscribe({
      next: (res) => {
        this.donations.set(page === 1 ? res.items : [...this.donations(), ...res.items]);
        this.donationsPage.set(res.page);
        this.donationsPages.set(res.pages);
        this.donationsTotal.set(res.total);
        this.loadingDonations.set(false);
      },
      error: () => {
        this.loadingDonations.set(false);
        this.donationsError.set(true);
      },
    });
  }
}
