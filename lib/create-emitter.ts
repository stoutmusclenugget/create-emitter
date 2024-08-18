import type { Config, Emitter, Fn, Subscription } from './types';
import { Type } from './types';
import { typeOf } from './type-of';

/**
 * @remarks createEmitter() provides a super flexible api for creating an asynchronous event
 * emitter. All events that are emitted through this api are fired off in the order in which they
 * are called while exposing each method as an aynchronous function.
 *
 * @param {Object} config - An static object of values. Also, optionally takes a special `initialize()`
 * function that will execute once before the first interaction with the emitter has resolved.
 *
 * @returns An object with the same functions you passed into the config object with the addition
 * of `subscribe()` and `initialized()` methods. The only difference is that all the methods you
 * passed into the config object are now asynchronous.
 */
export function createEmitter<T extends Config>(config: T): Emitter<T> {
  const queue: Array<() => unknown> = [];

  const subscriptions = new Map<symbol, Subscription<T>>();

  let enabled = true;
  let flushing = false;
  let initialized = false;

  async function dequeue() {
    if (queue.length === 0) {
      flushing = false;
      return;
    }

    const fn = queue.shift();
    await fn?.();
    dequeue();
  }

  function wrapValue(key: keyof T & string) {
    const value = config[key];

    function flush(settle: Fn) {
      if (key === 'initialize') {
        if (initialized) {
          return new Error('initialize() can only be called once.');
        } else {
          initialized = true;
          queue.unshift(settle);
        }
      } else {
        if (typeOf(config.initialize) === Type.Undefined) {
          initialized = true;
        }

        queue.push(settle);
      }

      if (!initialized || flushing) {
        return;
      }

      flushing = true;

      dequeue();
    }

    switch (typeOf(value)) {
      case Type.AsyncFunction:
        return async function enqueueAsynchronousMethod(...args: Parameters<T[keyof T]>) {
          return new Promise((resolve, reject) => {
            async function settle() {
              try {
                const result = await value(...args);

                if (enabled) {
                  for (const [, subscription] of subscriptions) {
                    try {
                      await Promise.allSettled([
                        subscription?.[key]?.(result, ...args),
                        subscription?.all?.<keyof T>(key, result, ...args),
                      ]);
                    } catch {}
                  }
                }

                resolve(result);
              } catch (error) {
                for (const [, subscription] of subscriptions) {
                  try {
                    await subscription?.catch?.<keyof T>(key, error as Error, ...args);
                  } catch {}
                }

                reject(error);
              }
            }

            const error = flush(settle);

            if (typeOf(error) === Type.Undefined) {
              return;
            }

            reject(error);
          });
        };
      case Type.Function:
        return function enqueueSynchronousMethod(...args: Parameters<T[keyof T]>) {
          function settle() {
            try {
              const result = value(...args);

              if (enabled) {
                for (const [, subscription] of subscriptions) {
                  try {
                    subscription?.[key]?.(result, ...args);
                    subscription?.all?.<keyof T>(key, result, ...args);
                  } catch {}
                }
              }

              return result;
            } catch (error) {
              for (const [, subscription] of subscriptions) {
                try {
                  subscription?.catch?.<keyof T>(key, error as Error, ...args);
                } catch {}
              }

              throw error;
            }
          }

          const error = flush(settle);

          if (typeOf(error) === Type.Undefined) {
            return;
          }

          throw error;
        };
      default:
        return value;
    }
  }

  return {
    ...(Object.keys(config).reduce(
      (accumulator, key) => ({
        ...accumulator,
        [key]: wrapValue(key),
      }),
      {},
    ) as T),

    get __SUBSCRIPTIONS__() {
      return subscriptions;
    },

    get enabled() {
      return enabled;
    },

    get flushing() {
      return flushing;
    },

    get initialized() {
      return initialized;
    },

    disable() {
      enabled = false;
    },

    enable() {
      enabled = true;
    },

    subscribe(subscription: Subscription<T>) {
      const key = Symbol(crypto.randomUUID());

      subscriptions.set(key, subscription);

      return function unsubscribe() {
        if (flushing) {
          queue.push(() => {
            subscriptions.delete(key);
          });

          return;
        }

        subscriptions.delete(key);
      };
    },
  } as const;
}
