# createEmitter()

This package provides a flexible API for creating an event emitter that enables the management of events in the order they are called. This emitter supports both synchronous and asynchronous event handling, ensuring that events are processed sequentially. Additionally, subscriptions are supported and can be triggered from these events.

## Installation

```bash
pnpm install @stoutmusclenugget/create-emitter
yarn add @stoutmusclenugget/create-emitter
pnpm add @stoutmusclenugget/create-emitter
```

## Why?

## Usage

### Creating an Emitter

Call the `createEmitter()` function by passing in a configuration object - a configuration object can map any value to its keys, including functions, objects, primitives, etc. Then you are returned an emitter where you have access to everything you passed in and some additional properties that are added for you.

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

1. [`const unsubscribe = emitter.subscribe()`](/README.md#L54): Allows you to subscribe to any method you passed into the initial configuration object.
2. `emitter.enable();`: Enables subscriptions to be triggered when their associated methods are called.
3. `emitter.disable();`: Disables subscriptions to method calls.
4. `emitter.enabled;`: A boolean value that tells you if subscriptions are enabled/disabled.
5. `emitter.flushing;`: A boolean value that tells you if the event queue is being flushed.
6. `emitter.initialized;`: A boolean value that tells you if the emitter has been intitialized.

## API

### `function createEmitter<T extends Config>(config: T): Emitter<T>`

### `emitter.subscribe(subscription: Subscription<T>): () => void`

### `emitter.enable(): void`

### `emitter.disable(): void`

### `emitter.enabled: boolean`

### `emitter.flushing: boolean`

### `emitter.initialized: boolean`

## License

This project is licensed under the MIT License.
