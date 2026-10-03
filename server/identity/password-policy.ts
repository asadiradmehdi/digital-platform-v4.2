import { AppError } from '../core/errors';

export function assertStrongPassword(password: string) {
  if (password.length < 14) throw new AppError('VALIDATION_ERROR','Password must be at least 14 characters.');
  if (!/[A-Z]/.test(password)) throw new AppError('VALIDATION_ERROR','Password must contain an uppercase letter.');
  if (!/[a-z]/.test(password)) throw new AppError('VALIDATION_ERROR','Password must contain a lowercase letter.');
  if (!/\d/.test(password)) throw new AppError('VALIDATION_ERROR','Password must contain a number.');
  if (!/[^A-Za-z0-9]/.test(password)) throw new AppError('VALIDATION_ERROR','Password must contain a symbol.');
}
