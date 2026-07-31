import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DonationStore } from '../../store/donation.store';
import { firstValueFrom } from 'rxjs';
import { DonationApi } from '../../api/donation.api';
import { getCurrencySymbol } from '@shared/utils/currency.util';
import { SecondaryButton } from '@shared/ui/secondary-button/secondary-button';

@Component({
  selector: 'app-donation-success',
  imports: [SecondaryButton],
  templateUrl: './donation-success.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonationSuccess {
  readonly #api = inject(DonationApi);

  readonly store = inject(DonationStore);
  readonly result = computed(() => this.store.submitResult());
  readonly sharing = signal(false);
  protected readonly getCurrencySymbol = getCurrencySymbol;

  // PagoEfectivo: the donation is created but not yet paid — no
  // certificate exists yet, only a CIP code to pay with later. See
  // PAYMENTS_ARCHITECTURE.md §7.2/§13 — a certificate is only generated
  // once a webhook confirms the actual payment.
  readonly isProcessing = computed(() => this.result()?.status === 'processing');

  // True while pollConfirmation() is waiting on a recurring subscription's
  // first-charge webhook — see DonationStore.pollConfirmation. Shows a
  // loader instead of either the normal success content or the "we'll email
  // you" fallback, since we don't yet know which of those is correct.
  readonly awaitingConfirmation = computed(() => this.store.awaitingConfirmation());

  donateAgain(): void {
    this.store.resetForm();
    window.location.reload();
  }

  viewCertificate(): void {
    const result = this.result();
    if (!result?.certificateFileUrl) return;
    window.open(this.#api.getCertificateUrl(result.certificateFileUrl), '_blank');
  }

  async downloadCertificate(): Promise<void> {
    const result = this.result();
    if (!result?.certificateFileUrl) return;

    const blob = await firstValueFrom(this.#api.downloadCertificate(result.certificateFileUrl));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // The downloaded file keeps the sequential certificate number as its
    // name — only the fetch URL uses the non-guessable identifier.
    a.download = `${result.certificateNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async share(): Promise<void> {
    const result = this.result();
    if (!result) return;

    const symbol = this.getCurrencySymbol(result.currency);
    const title = `Doné ${symbol} ${result.amount} a ${this.store.page()?.organizationName}`;
    const text = `Acabo de hacer una donación de ${symbol} ${result.amount}. ¡Tú también puedes ayudar!`;
    const url = window.location.href;

    if (!navigator.share) {
      await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
      alert('Enlace copiado al portapapeles');
      return;
    }

    this.sharing.set(true);

    try {
      if (result.certificateFileUrl && navigator.canShare) {
        try {
          const pdfBlob = await this.#fetchCertificatePdf(result.certificateFileUrl);
          const file = new File([pdfBlob], `${result.certificateNumber}.pdf`, {
            type: 'application/pdf',
          });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ title, text, url, files: [file] });
            return;
          }
        } catch {
          // PDF fetch failed — fall through to share without file
        }
      }
      await navigator.share({ title, text, url });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[DonationSuccess] share error:', err);
      }
    } finally {
      this.sharing.set(false);
    }
  }

  async #fetchCertificatePdf(certificateFileUrl: string): Promise<Blob> {
    return firstValueFrom(this.#api.downloadCertificate(certificateFileUrl));
  }
}
