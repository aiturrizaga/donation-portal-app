import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PortalLegalPageSummary {
  slug: string;
  title: string;
}

export interface PortalLegalPage {
  slug: string;
  title: string;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class LegalPageApi {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiUrl}/v1/portal/legal-pages`;

  getAll(): Observable<PortalLegalPageSummary[]> {
    return this.#http
      .get<ApiResponse<PortalLegalPageSummary[]>>(this.#base)
      .pipe(map((r) => r.data));
  }

  getBySlug(slug: string): Observable<PortalLegalPage> {
    return this.#http
      .get<ApiResponse<PortalLegalPage>>(`${this.#base}/${slug}`)
      .pipe(map((r) => r.data));
  }
}
