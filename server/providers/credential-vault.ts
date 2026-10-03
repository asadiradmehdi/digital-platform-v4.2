import { query } from '../core/db';
import { encryptSecret, decryptSecret } from '../core/secret-box';

export async function getProviderCredentials(providerId: string): Promise<Record<string, string>> {
  const r = await query<{ credential_name: string; secret_ciphertext: string }>(
    `SELECT credential_name, secret_ciphertext FROM provider_credentials WHERE provider_id=$1 AND active=true`,
    [providerId]
  );
  const creds: Record<string, string> = {};
  for (const row of r.rows) {
    creds[row.credential_name] = decryptSecret(row.secret_ciphertext);
  }
  return creds;
}

export async function upsertProviderCredential(providerId: string, name: string, plain: string): Promise<void> {
  const ciphertext = encryptSecret(plain);
  await query(
    `INSERT INTO provider_credentials(provider_id, credential_name, secret_ciphertext)
     VALUES($1,$2,$3)
     ON CONFLICT(provider_id, credential_name) DO UPDATE SET secret_ciphertext=$3, active=true`,
    [providerId, name, ciphertext]
  );
}

export async function revokeProviderCredential(providerId: string, name: string): Promise<void> {
  await query(
    `UPDATE provider_credentials SET active=false WHERE provider_id=$1 AND credential_name=$2`,
    [providerId, name]
  );
}
