import type { Config, Emitter, Subscription } from './types';
import { Type } from './types';
import { typeOf } from './type-of';

const INITIALIZE_KEY = 'initialize';

const InitializeError = new Error(`${INITIALIZE_KEY}() can only be called once.`);

/**
 * Creates an emitter object that wraps the provided configuration object, enabling
 * asynchronous and synchronous methods to be queued, executed, and observed via subscriptions.
 *
 * @template T - The configuration type that defines the emitter's methods and properties.
 * @param config - The configuration object containing methods and properties to wrap.
 *
 * @returns An emitter object with the following features:
 * - Wrapped methods that support queuing and subscription-based event handling.
 * - State controls (`enabled`, `flushing`, `initialized`) to manage the emitter's behavior.
 * - Subscription management for observing method calls and errors.
 *
 * @remarks
 * - The `initialize` method (if defined) can only be called once. Subsequent calls will throw an error.
 * - Asynchronous methods are queued and executed in order, while synchronous methods are executed immediately.
 * - Subscriptions can be added to listen for method calls, results, and errors.
 * - The emitter can be enabled or disabled, affecting whether subscriptions are triggered.
 *
 * @example
 * ```typescript
 * const emitter = createEmitter({
 *   async initialize() {
 *     console.log('Initializing...');
 *   },
 *   async fetchData() {
 *     return await fetch('/api/data');
 *   },
 *   logMessage(message: string) {
 *     console.log(message);
 *   },
 * });
 *
 * emitter.subscribe({
 *   initialize: () => console.log('Initialized'),
 *   fetchData: (data) => console.log('Data fetched:', data),
 *   catch: (key, error) => console.error(`Error in ${key}:`, error),
 * });
 *
 * await emitter.initialize();
 * await emitter.fetchData();
 * emitter.logMessage('Hello, world!');
 * ```
 */
export function createEmitter<T extends Config>(config: T): Emitter<T> {
  const queue: Array<() => unknown> = [];

  const subscriptions = new Map<symbol, Subscription<T>>();

  let enabled = config.enabled ?? true;
  let flushing = false;
  let initialized = false;

  /**
   * Processes the queue of asynchronous functions, executing them in order.
   * Once the queue is empty, the `flushing` state is set to `false`.
   */
  async function dequeue() {
    if (queue.length === 0) {
      flushing = false;
      return;
    }

    const fn = queue.shift();

    await fn?.();

    dequeue();
  }

  /**
   * Wraps a value from the configuration object. Depending on the type of the value,
   * it may be wrapped as an asynchronous or synchronous method.
   *
   * @param key - The key of the configuration object to wrap.
   * @returns The wrapped value or the original value if it is not a function.
   */
  function wrapValue(key: keyof T) {
    const value = config[key];

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

            if (key === INITIALIZE_KEY) {
              if (initialized) {
                throw InitializeError;
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
            if (key === INITIALIZE_KEY) {
              if (initialized) {
                throw InitializeError;
              } else {
                initialized = true;
              }
            } else {
              if (typeOf(config.initialize) === Type.Undefined) {
                initialized = true;
              }
            }

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
        };
      default:
        return value;
    }
  }

  return {
    /**
     * Contains all the wrapped methods and properties from the configuration object.
     * Methods are wrapped to support queuing, subscriptions, and error handling.
     */
    ...(Object.keys(config).reduce(
      (accumulator, key) => ({
        ...accumulator,
        [key]: wrapValue(key),
      }),
      {},
    ) as T),

    /**
     * A map of all active subscriptions. Each subscription is identified by a unique symbol.
     * This is primarily for internal use.
     */
    get __SUBSCRIPTIONS__() {
      return subscriptions;
    },

    /**
     * Indicates whether the emitter is currently enabled.
     * When disabled, subscriptions are not triggered.
     *
     * @returns `true` if the emitter is enabled, `false` otherwise.
     */
    get enabled() {
      return enabled;
    },

    /**
     * Indicates whether the emitter is currently flushing the queue of asynchronous methods.
     * When `true`, the emitter is processing queued methods.
     *
     * @returns `true` if the emitter is flushing, `false` otherwise.
     */
    get flushing() {
      return flushing;
    },

    /**
     * Indicates whether the `initialize` method has been called.
     * If the `initialize` method is defined, it can only be called once.
     *
     * @returns `true` if the emitter has been initialized, `false` otherwise.
     */
    get initialized() {
      return initialized;
    },

    /**
     * Disables the emitter, preventing subscriptions from being triggered.
     * This does not affect the execution of methods but suppresses subscription callbacks.
     */
    disable() {
      enabled = false;
    },

    /**
     * Enables the emitter, allowing subscriptions to be triggered.
     * This resumes subscription callbacks if they were previously disabled.
     */
    enable() {
      enabled = true;
    },

    /**
     * Adds a subscription to the emitter, allowing observation of method calls and errors.
     *
     * @param subscription - The subscription object containing callback functions for specific methods or errors.
     * @returns A function to unsubscribe the added subscription.
     *
     * @example
     * ```typescript
     * const unsubscribe = emitter.subscribe({
     *   fetchData: (result) => console.log('Data fetched:', result),
     *   catch: (key, error) => console.error(`Error in ${key}:`, error),
     * });
     *
     * // To unsubscribe:
     * unsubscribe();
     * ```
     */
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
