import type { Config, Emitter, Subscription, Subscriptions } from './types';

/**
 * @remarks {@link createEmitter} provides a super flexible api for creating an asynchronous event
 * emitter. All events that are emitted through this api are fired off in the order in which they
 * are called while exposing each method as an aynchronous function.
 *
 * @param {Object} config - An object of functions. Also, optionally takes a special `initialize()`
 * function that will execute once before the first interaction with the emitter has resolved.
 *
 * @returns An object with the same functions you passed into the config object with the addition
 * of `subscribe()` and `initialized()` methods. The only difference is that all the methods you
 * passed into the config object are now asynchronous.
 *
 * @example
 *
 * const logger = createEmitter({
 *   error: message => ({
 *     level: 'error',
 *     message,
 *     timestamp: Date.now()
 *   }),
 * });
 *
 * logger.subscribe({
 *   error: ({ level, ...log }) => console[log.level](log),
 * });
 *
 * logger.error(':(');
 */

export function createEmitter<T extends Config>(config: T): Emitter<T> {
  const queue: Array<() => Promise<void>> = [];

  const subscriptions: Subscriptions<T> = {};

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

  function createMethod(key: keyof T & string) {
    return async function enqueueMethod(...args: Parameters<T[keyof T]>) {
      return new Promise((resolve, reject) => {
        async function settle() {
          try {
            const fn = config[key];

            const result = await fn(...args);

            if (enabled) {
              for (const symbol of Object.getOwnPropertySymbols(
                subscriptions,
              )) {
                const subscription = subscriptions[symbol];

                try {
                  await Promise.allSettled([
                    subscription[key]?.(result, ...args),
                    subscription.all?.<keyof T>(key, result, ...args),
                  ]);
                } catch (error) {
                  console.error(error);
                }
              }
            }

            resolve(result);
          } catch (error) {
            for (const symbol of Object.getOwnPropertySymbols(subscriptions)) {
              try {
                const subscription = subscriptions[symbol];

                await subscription?.catch?.<keyof T>(
                  key,
                  error as Error,
                  ...args,
                );
              } catch (error) {
                console.error(error);
              }
            }

            reject(error);
          }
        }

        if (key === 'initialize') {
          if (initialized) {
            reject(new Error(`initialize() can only be called once.`));
            return;
          } else {
            initialized = true;
            queue.unshift(settle);
          }
        } else {
          if (typeof config.initialize === 'undefined') {
            initialized = true;
          }

          queue.push(settle);
        }

        if (!initialized || flushing) {
          return;
        }

        flushing = true;

        dequeue();
      });
    };
  }

  const properties = Object.keys(config).reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key]: (typeof config[key]).includes('function')
        ? createMethod(key)
        : config[key],
    }),
    {},
  );

  return {
    ...(properties as T),

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

      subscriptions[key] = subscription;

      return function unsubscribe() {
        if (flushing) {
          queue.push(async () => {
            delete subscriptions[key];
          });

          return;
        }

        delete subscriptions[key];
      };
    },
  } as const;
}

export const emitter = createEmitter({
  poop() {},
});
