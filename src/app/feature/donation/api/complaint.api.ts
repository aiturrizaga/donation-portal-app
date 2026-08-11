import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { ComplaintFormState, ComplaintSubmitResponse } from '../models/complaint.model';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class ComplaintApi {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiUrl}/v1/portal/complaints`;

  submit(payload: ComplaintFormState): Observable<ComplaintSubmitResponse> {
    return this.#http
      .post<ApiResponse<ComplaintSubmitResponse>>(this.#base, payload)
      .pipe(map((r) => r.data));
  }
}
