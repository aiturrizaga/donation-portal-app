// Provider-agnostic result of a checkout attempt — everything outside
// culqi-checkout.service.ts works with this, never with Culqi's own
// token/order/error shapes directly. If a second gateway is ever added, its
// own service would return this exact same union.
export type PaymentResult =
  | { kind: 'token'; token: string } // card — ready to charge synchronously
  | { kind: 'cancelled' } // donor closed the checkout without completing
  | { kind: 'error'; message: string }; // already a human-readable message

// Outcome of a Culqi3DS challenge (culqi-checkout.service.ts#runChallenge) —
// a SEPARATE step from tokenization, only entered when our backend reports
// a donation as status "requires_3ds" after the first charge attempt.
export type ThreeDSChallengeResult =
  | {
      kind: 'success';
      parameters3DS: {
        eci: string;
        xid: string;
        cavv: string;
        protocolVersion: string;
        directoryServerTransactionId: string;
      };
    }
  | { kind: 'error'; message: string }; // already a human-readable message
