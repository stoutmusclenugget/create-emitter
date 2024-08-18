import { Type } from './types';

export function typeOf(value: unknown): Type {
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase() as unknown as Type;
}
