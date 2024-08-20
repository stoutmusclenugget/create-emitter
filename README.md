# createEmitter()

This package provides a flexible API for creating an event emitter that forces events to execute and resolve in the order in which they are called. This emitter supports both synchronous and asynchronous event handling, ensuring that events are processed sequentially. Additionally, subscriptions are supported and can be triggered from these events.

## Table of Contents

1. [Installation](#installation)
2. [Why?](#why)
3. [Usage](#usage)

- [Creating an Emitter](#creating-an-emitter)

4. [API](#api)

- [function createEmitter<T extends Config>(config: T): Emitter](#function-createemittert-extends-configconfig-t-emitter)
- [emitter.subscribe(subscription: Subscription): () => void](#emittersubscribesubscription-subscription---void)
- [emitter.enable(): void](#emitterenable-void)
- [emitter.disable(): void](#emitterdisable-void)
- [emitter.enabled: boolean](#emitterenabled-boolean)
- [emitter.flushing: boolean](#emitterflushing-boolean)
- [emitter.initialized: boolean](#emitterinitialized-boolean)

5. [Types](#types)

- [Fn](#fn)
- [Config](#config)
- [Subscription](#subscription)
- [Emitter](#emitter)

6. [License](#license)

## Installation

```bash
npm install @stoutmusclenugget/create-emitter
yarn add @stoutmusclenugget/create-emitter
pnpm add @stoutmusclenugget/create-emitter
```

```ts
import { createEmitter, type CreateEmitter } from '@stoutmusclenugget/create-emitter';
```

## Why?

## Usage

### Creating an Emitter

Call the [`createEmitter()`](#function-createemittert-extends-configconfig-t-emitter) function by passing in a configuration object - a configuration object can map any value to its keys, including: functions, objects, primitives, etc.

```ts
import { createEmitter } from '@stoutmusclenugget/create-emitter';

const emitter = createEmitter({
  async asynchronousMethod() {},
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

1. [`const unsubscribe = emitter.subscribe()`](#emittersubscribesubscription-subscription---void): Allows you to subscribe to any method you passed into the initial configuration object.
2. [`emitter.enable();`](#emitterenable-void): Enables subscriptions to be triggered when their associated methods are called.
3. [`emitter.disable();`](#emitterdisable-void): Disables subscriptions to method calls.
4. [`emitter.enabled;`](#emitterenabled-boolean): A boolean value that tells you if subscriptions are enabled/disabled.
5. [`emitter.flushing;`](#emitterflushing-boolean): A boolean value that tells you if the event queue is being flushed.
6. [`emitter.initialized;`](#emitterinitialized-boolean): A boolean value that tells you if the emitter has been intitialized.

## API

### `function createEmitter<T extends `[Config](#config)`>(config: T): `[Emitter](#emitter)`<T>`

This function is used to create an emitter. You pass in a configuration object that maps keys to any other value. If any number of functions are passed in, under the hood we wrap these values in special logic that forces the functions to be executed in the order they were called. Furthermore, you can subscribe to any of these functions to trigger side-effects of your own.

#### Things to Know

1. The config parameter is an object that can contain methods, properties, and an optional `initialize` method.
2. If provided, the `initialize` function when triggered will be executed once before the first interaction with the emitter.
3. Returns an `Emitter` object that includes the same methods and properties as those defined in the config object. Additionally, it includes methods for subscribing to events and managing the emitter's internal state.
4. All methods are processed sequentially to avoid race conditions by maintaining an internal queue to manage the order of event execution.

```ts
import { createEmitter } from '@stoutmusclenugget/create-emitter';

const emitter = createEmitter({
  async asynchronousMethod() {},
  synchronousMethod() {},
  staticNumber: 1,
  staticString: 'example',
  staticObject: {},
});

await emitter.asynchronousMethod(); // Promise<void>
emitter.synchronousMethod(); // void
emitter.staticNumber; // 1
emitter.staticString; // 'example'
emitter.staticObject; // {}
```

### `emitter.subscribe(subscription:` [Subscription](#subscription)`<T>): () => void`

To trigger side-effects when using the createEmitter function, you can use the subscribe method provided by the emitter. This method allows you to define functions that will be called whenever the corresponding methods in the emitter are triggered. You can also use the `all` and `catch` handlers to handle all events and errors, respectively.

#### Things to Know

1. When you call `emitter.subscribe()`, an unsubcribe function is returned.
2. Anything you return from a config method will get passed directly to each subscription as its first argument.
3. Any arguments to a config method will get passed directly to each subscription as its subsequent arguments.
4. If you call the `unsubscribe()` function that is returned, the subscription will be removed and no longer get triggered.
5. You can subscribe to all events using a single handler with the key `all`.
6. You can subscribe to any errors that get thrown within methods using the key `catch`.

```ts
import { createEmitter } from '@stoutmusclenugget/create-emitter';

// Whatever you return from a method then gets passed to each subscription as the first argument.
const emitter = createEmitter({
  async asynchronousMethod() {
    return 'asynchronousMethod';
  },
  synchronousMethod() {
    return 'synchronousMethod';
  },
});

// When you subscribe, you receive an unsubscribe() function as a return value.
const unsubscribe = emitter.subscribe({
  asynchronousMethod(method) {
    console.log(`Executing `${method}` subscription...`);
  },
  synchronousMethod(method) {
    console.log(`Executing `${method}` subscription...`);
  },
});

emitter.asynchronousMethod(); // log: 'Executing asynchronousMethod subscription...'
emitter.synchronousMethod(); // log: 'Executing synchronousMethod subscription...'

unsubscribe(); // Unsubscribing removes the subscription so it is no longer executed.

emitter.asynchronousMethod(); // Nothing logs.
emitter.synchronousMethod(); // Nothing logs.
```

### `emitter.enable(): void`

The emitter can be enabled using the `enable()` method. When enabled, subscriptions are triggered. Subscriptions are enabled by default.

```ts
const emitter = createEmitter({
  method() {},
});

emitter.subscribe({
  method() {
    console.log(`Executing method subscription...`);
  },
});

emitter.disable();

emitter.method(); // Logs Nothing.

emitter.enable();

emitter.method(); // log: 'Executing method subscription...'
```

### `emitter.disable(): void`

The emitter can be disabled using the `disable()` method. When disabled, subscriptions are not triggered.

```ts
const emitter = createEmitter({
  method() {},
});

emitter.subscribe({
  method() {
    console.log(`Executing method subscription...`);
  },
});

emitter.method(); // log: 'Executing method subscription...'

emitter.disable();

emitter.method(); // Logs nothing.
```

### `emitter.enabled: boolean`

### `emitter.flushing: boolean`

### `emitter.initialized: boolean`

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
