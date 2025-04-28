import type { Config, Emitter, Subscription } from './types';
import { Type } from './types';
import { typeOf } from './type-of';

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
  const taskQueue: Array<() => unknown> = [];

  const subscriptions = new Map<symbol, Subscription<T>>();

  let enabled = config.enabled ?? true;
  let flushing = false;
  let initialized = !config.initialize;

  /**
   * Processes the queue of asynchronous functions, executing them in order.
   * Once the queue is empty, the `flushing` state is set to `false`.
   */
  async function flush() {
    while (taskQueue.length > 0) {
      const task = taskQueue.shift();
      await task?.();
    }

    flushing = false;
  }

  /**
   * Handles invoking subscription callbacks for a given key, result, and arguments.
   *
   * @param key - The key of the method being invoked.
   * @param args - The arguments passed to the method.
   * @param result - The result or error of the method invocation.
   */
  async function handleSubscriptions(
    key: keyof T,
    args: Parameters<T[keyof T]>,
    result: Awaited<ReturnType<T[keyof T]>> | Error,
  ) {
    for (const [, subscription] of subscriptions) {
      try {
        if (result instanceof Error) {
          await subscription?.catch?.<keyof T>(key, result, ...args);
        } else {
          const results = await Promise.allSettled([
            subscription?.[key]?.(result, ...args),
            subscription?.all?.<keyof T>(key, result, ...args),
          ]);

          results.forEach((settlement) => {
            if (settlement.status !== 'rejected') {
              return;
            }

            console.error(`Subscription for ${String(key)} failed:`, settlement.reason);
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  /**
   * Wraps a value from the configuration object. Depending on the type of the value,
   * it may be wrapped as an asynchronous or synchronous method.
   *
   * @param key - The key of the configuration object to wrap.
   * @returns The wrapped value or the original value if it is not a function.
   */
  function wrapValue(key: keyof T, value = config[key]) {
    const type = typeOf(value);

    if (type === Type.AsyncFunction) {
      return async function enqueueAsynchronousMethod(...args: Parameters<T[keyof T]>) {
        return new Promise((resolve, reject) => {
          async function settle() {
            try {
              const result = await value(...args);

              if (enabled) {
                await handleSubscriptions(key, args, result);
              }

              resolve(result);
            } catch (error: unknown) {
              await handleSubscriptions(key, args, error as Error);

              reject(error);
            }
          }

          if (value === config.initialize) {
            if (initialized) {
              reject(new Error(`initialize() can only be called once.`));
              return;
            } else {
              initialized = true;
              taskQueue.unshift(settle);
            }
          } else {
            taskQueue.push(settle);
          }

          if (!initialized || flushing) {
            return;
          }

          flushing = true;

          flush();
        });
      };
    } else if (type === Type.Function) {
      return function executeSynchronousMethod(...args: Parameters<T[keyof T]>) {
        try {
          const result = value(...args);

          if (enabled) {
            handleSubscriptions(key, args, result);
          }

          return result;
        } catch (error: unknown) {
          handleSubscriptions(key, args, error as Error);

          throw error;
        }
      };
    }

    return value;
  }

  return {
    /**
     * Contains all the wrapped methods and properties from the configuration object.
     * Methods are wrapped to support queuing, subscriptions, and error handling.
     */
    ...(Object.entries(config).reduce(
      (accumulator, [key, value]) => ({
        ...accumulator,
        [key]: wrapValue(key, value),
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
      const key = Symbol(Date.now());

      subscriptions.set(key, subscription);

      return function unsubscribe() {
        if (flushing) {
          taskQueue.push(async () => {
            subscriptions.delete(key);
          });

          return;
        }

        subscriptions.delete(key);
      };
    },
  } as const;
}
