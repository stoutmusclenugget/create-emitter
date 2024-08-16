/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AsyncReturnType, ConditionalPick } from 'type-fest';

export type Fn = (...args: any) => any;

export type Config = Record<string, any> & { initialize?: Fn };

export type Subscription<
  C extends ConditionalPick<Config, Fn>,
  Key extends keyof C = keyof C,
> = Readonly<
  {
    [Key in keyof C]?: (
      payload: AsyncReturnType<C[Key]>,
      ...args: Parameters<C[Key]>
    ) => unknown;
  } & {
    all?<K extends Key>(key: K, payload: AsyncReturnType<C[K]>): unknown;
    all?<K extends Key>(
      key: K,
      payload: AsyncReturnType<C[K]>,
      ...args: Parameters<C[K]>
    ): unknown;

    catch?<K extends Key>(key: K, payload: Error): unknown;
    catch?<K extends Key>(
      key: K,
      payload: Error,
      ...args: Parameters<C[K]>
    ): unknown;
  }
>;

export type Subscriptions<T extends Config> = Record<symbol, Subscription<T>>;

export type Emitter<T extends Config> = T & {
  __SUBSCRIPTIONS__: Subscriptions<T>;
  get enabled(): boolean;
  get flushing(): boolean;
  get initialized(): boolean;
  disable(): void;
  enable(): void;
  subscribe(subscription: Subscription<T>): () => void;
};

export * as CreateEmitter from './types.js';
