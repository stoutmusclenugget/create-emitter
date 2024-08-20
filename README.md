# createEmitter()

This package provides a flexible API for creating an event emitter that enables the management of events in the order they are called. This emitter supports both synchronous and asynchronous event handling, ensuring that events are processed sequentially. Additionally, subscriptions are supported and can be triggered from these events.

## Installation

```bash
npm install @stoutmusclenugget/create-emitter
yarn add @stoutmusclenugget/create-emitter
pnpm add @stoutmusclenugget/create-emitter
```

## Why?

## Usage

### Creating an Emitter

Call the [`createEmitter()`](#function-createemittert-extends-configconfig-t-emittert) function by passing in a configuration object - a configuration object can map any value to its keys, including: functions, objects, primitives, etc.

```ts
import { createEmitter } from '@stoutmusclenugget/create-emitter';

const emitter = createEmitter({
  async asynchronouseMethod() {},
  synchronousMethod() {},
  staticNumber: 1,
  staticString: 'example',
  staticObject: {},
});
```

You then have access to all of the methods and properties passed from the configuration object. Of note, the signature of each method and property remains unchanged. Methods are wrapped in a special queueing functionality that allows us to fire events off in sequential order to avoid race conditions.

```ts
await emitter.asynchronousMethod(); // Promise<void>
emitter.synchronousMethod(); // void
emitter.staticNumber; // 1
emitter.staticString; // 'example'
emitter.staticObject; // {}
```

In addition to the methods and properties you passed in, you now have access to the following methods and properties, which I will explain in depth further down:

1. [`const unsubscribe = emitter.subscribe()`](#emittersubscribesubscription-subscriptiont---void): Allows you to subscribe to any method you passed into the initial configuration object.
2. [`emitter.enable();`](): Enables subscriptions to be triggered when their associated methods are called.
3. `emitter.disable();`: Disables subscriptions to method calls.
4. `emitter.enabled;`: A boolean value that tells you if subscriptions are enabled/disabled.
5. `emitter.flushing;`: A boolean value that tells you if the event queue is being flushed.
6. `emitter.initialized;`: A boolean value that tells you if the emitter has been intitialized.

## API

### function createEmitter<`T` extends [Config](#config)>(config: `T`): [Emitter](#emitter)<T>

### emitter.subscribe(subscription: [Subscription](#subscription)<T>): `() => void`

### emitter.enable(): `void`

### emitter.disable(): `void`

### emitter.enabled: `boolean`

### emitter.flushing: `boolean`

### emitter.initialized: `boolean`

## Types

### `Fn`

```ts
type Fn = (...args: any) => any;
```

### `Config`

```ts
type Config = Record<string, any> & { initialize?: Fn };
```

### `Subscription`

```ts
type Subscription<C extends ConditionalPick<Config, Fn>, Key extends keyof C = keyof C> = Readonly<
  {
    [Key in keyof C]?: (payload: AsyncReturnType<C[Key]>, ...args: Parameters<C[Key]>) => unknown;
  } & {
    all?<K extends Key>(key: K, payload: AsyncReturnType<C[K]>): unknown;
    all?<K extends Key>(key: K, payload: AsyncReturnType<C[K]>, ...args: Parameters<C[K]>): unknown;
    catch?<K extends Key>(key: K, payload: Error): unknown;
    catch?<K extends Key>(key: K, payload: Error, ...args: Parameters<C[K]>): unknown;
  }
>;
```

### `Emitter`

```ts
type Emitter<C extends Config> = C & {
  __SUBSCRIPTIONS__: Map<symbol, Subscription<C>>;
  get enabled(): boolean;
  get flushing(): boolean;
  get initialized(): boolean;
  disable(): void;
  enable(): void;
  subscribe(subscription: Subscription<ConditionalPick<C, Fn>>): () => void;
};
```

## License

This project is licensed under the MIT License.
