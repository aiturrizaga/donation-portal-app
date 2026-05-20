import { Component, computed, inject, input, signal } from '@angular/core';
import { DonationStore } from '../../store/donation.store';
import { firstValueFrom } from 'rxjs';
import { DonationApi } from '../../api/donation.api';

@Component({
  selector: 'app-donation-success',
  imports: [],
  templateUrl: './donation-success.html',
})
export class DonationSuccess {
  readonly #api = inject(DonationApi);

  readonly store = input.required<InstanceType<typeof DonationStore>>();
  readonly result = computed(() => this.store().submitResult());
  readonly sharing = signal(false);

  getCurrencySymbol(currency: string): string {
    return currency === 'PEN' ? 'S/' : 'US$';
  }

  donateAgain(): void {
    this.store().resetForm();
    window.location.reload();
  }

  viewCertificate(): void {
    const result = this.result();
    if (!result?.certificateNumber) return;
    window.open(this.#api.getCertificateUrl(result.certificateNumber), '_blank');
  }

  async downloadCertificate(): Promise<void> {
    const result = this.result();
    if (!result?.certificateNumber) return;

    const blob = await firstValueFrom(this.#api.downloadCertificate(result.certificateNumber));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.certificateNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async share(): Promise<void> {
    const result = this.result();
    if (!result) return;

    const symbol = this.getCurrencySymbol(result.currency);
    const title = `Doné ${symbol} ${result.amount} a ${this.store().page()?.organizationName}`;
    const text = `Acabo de hacer una donación de ${symbol} ${result.amount}. ¡Tú también puedes ayudar!`;
    const url = window.location.href;

    if (!navigator.share) {
      await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
      alert('Enlace copiado al portapapeles');
      return;
    }

    this.sharing.set(true);

    try {
      if (result.certificateNumber && navigator.canShare) {
        try {
          const pdfBlob = await this.#fetchCertificatePdf(result.certificateNumber);
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

  async #fetchCertificatePdf(certificateNumber: string): Promise<Blob> {
    return firstValueFrom(this.#api.downloadCertificate(certificateNumber));
  }
}
