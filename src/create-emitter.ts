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

/**
 * @remarks {@link typeOf typeOf()} returns the type of the given value.
 *
 * @param {unknown} value The value to check.
 * @returns array | function | null | number | object | promise | regexp | string | symbol | undefined
 *
 * @example
 *
 * ```ts
 * typeOf(''); // string
 * ```
 */

export enum Type {
  Array = 'array',
  AsyncFunction = 'asyncfunction',
  Error = 'error',
  Function = 'function',
  Null = 'null',
  Number = 'number',
  Object = 'object',
  Promise = 'promise',
  Regexp = 'regexp',
  String = 'string',
  Symbol = 'symbol',
  Undefined = 'undefined',
}

export function typeOf(value: unknown): Type {
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase() as unknown as Type;
}

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
    const fn = config[key];

    switch (typeOf(fn)) {
      case Type.AsyncFunction:
        return async function enqueueAsynchronousMethod(...args: Parameters<T[keyof T]>) {
          return new Promise((resolve, reject) => {
            async function settle() {
              try {
                const result = await fn(...args);

                if (enabled) {
                  for (const symbol of Object.getOwnPropertySymbols(subscriptions)) {
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
                    await subscription?.catch?.<keyof T>(key, error as Error, ...args);
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
          });
        };
      case Type.Function:
        return function executeSynchronousMethod(...args: Parameters<T[keyof T]>) {
          try {
            if (key === 'initialize') {
              if (initialized) {
                throw new Error(`initialize() can only be called once.`);
              } else {
                initialized = true;
              }
            } else {
              if (typeOf(config.initialize) === Type.Undefined) {
                initialized = true;
              }
            }

            const result = fn(...args);

            if (enabled) {
              for (const symbol of Object.getOwnPropertySymbols(subscriptions)) {
                try {
                  const subscription = subscriptions[symbol];
                  subscription[key]?.(result, ...args);
                  subscription.all?.<keyof T>(key, result, ...args);
                } catch (error) {
                  console.error(error);
                }
              }
            }

            return result;
          } catch (error) {
            for (const symbol of Object.getOwnPropertySymbols(subscriptions)) {
              try {
                const subscription = subscriptions[symbol];
                subscription.catch?.<keyof T>(key, error as Error, ...args);
              } catch (error) {
                console.error(error);
              }
            }

            throw error;
          }
        };

      default:
        throw new Error(':(');
    }
  }

  const properties = Object.keys(config).reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key]: typeOf(config[key]).includes(Type.Function) ? createMethod(key) : config[key],
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
