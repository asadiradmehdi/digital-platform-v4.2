import { verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { createHash } from 'node:crypto';
import type { PasskeyVerifier, AttestationVerificationResult, AssertionVerificationResult } from './passkey-service';

function extractOriginAndRpId(rpIdOrOrigin: string): { origin: string; rpId: string } {
  if (rpIdOrOrigin.startsWith('http')) {
    try {
      const url = new URL(rpIdOrOrigin);
      return { origin: rpIdOrOrigin, rpId: url.hostname };
    } catch { /* fall through */ }
  }
  return { origin: `https://${rpIdOrOrigin}`, rpId: rpIdOrOrigin };
}

export function createSimpleWebAuthnVerifier(): PasskeyVerifier {
  return {
    async verifyAttestation(
      challenge: string,
      attestationResponse: unknown,
      rpIdOrOrigin: string,
    ): Promise<AttestationVerificationResult> {
      const { origin, rpId } = extractOriginAndRpId(rpIdOrOrigin);
      const verification = await verifyRegistrationResponse({
        response: attestationResponse as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        requireUserVerification: false,
      });
      if (!verification.verified || !verification.registrationInfo) {
        throw new Error('WebAuthn attestation verification failed');
      }
      const { credential } = verification.registrationInfo;
      const credentialIdHash = createHash('sha256').update(credential.id).digest('hex');
      const publicKey = Buffer.from(credential.publicKey).toString('base64');
      return { credentialIdHash, publicKey, signCount: credential.counter };
    },

    async verifyAssertion(
      challenge: string,
      assertionResponse: unknown,
      publicKeyBase64: string,
      currentSignCount: number,
      rpIdOrOrigin: string,
    ): Promise<AssertionVerificationResult> {
      const { origin, rpId } = extractOriginAndRpId(rpIdOrOrigin);
      const response = assertionResponse as AuthenticationResponseJSON;
      const buf = Buffer.from(publicKeyBase64, 'base64');
      const publicKey = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) as Uint8Array<ArrayBuffer>;
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        credential: {
          id: response.id,
          publicKey,
          counter: currentSignCount,
        },
        requireUserVerification: false,
      });
      if (!verification.verified || !verification.authenticationInfo) {
        throw new Error('WebAuthn assertion verification failed');
      }
      const credentialIdHash = createHash('sha256').update(response.id).digest('hex');
      return {
        credentialIdHash,
        newSignCount: verification.authenticationInfo.newCounter,
      };
    },
  };
}

/** Cached singleton verifier instance. */
export const simpleWebAuthnVerifier: PasskeyVerifier = createSimpleWebAuthnVerifier();
