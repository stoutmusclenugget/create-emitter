import { createEmitter, typeOf, Type } from './create-emitter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('createEmitter()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Returns static properties', () => {
    const emitter = createEmitter({
      property: 'Hello, world!',
    });

    expect(emitter).toHaveProperty('property', 'Hello, world!');
  });

  it('Returns asynchronous versions of all the methods you pass into config.', () => {
    const emitter = createEmitter({
      async first() {},
      async second() {},
    });

    expect(emitter).toHaveProperty('first');
    expect(emitter).toHaveProperty('second');
    expect(typeOf(emitter.first)).toEqual(Type.AsyncFunction);
    expect(typeOf(emitter.second)).toEqual(Type.AsyncFunction);
    expect(emitter.first()).toHaveProperty('then');
    expect(emitter.second()).toHaveProperty('then');
  });

  it('Resolves method calls in the order in which they are called.', async () => {
    const callStack: Array<string> = [];

    const first = vi.fn(() => callStack.push('first'));

    const second = vi.fn(() => callStack.push('second'));

    const emitter = createEmitter({
      first,
      second,
    });

    emitter.first();
    await emitter.second();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(callStack).toMatchObject(['first', 'second']);
  });

  it('Resolves method calls in the order in which they are called regardless of execution time.', async () => {
    const callStack: Array<string> = [];

    const first = async () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          callStack.push('first');
          resolve();
        }, 1000),
      );

    const second = async () => callStack.push('second');

    const emitter = createEmitter({
      first,
      second,
    });

    emitter.first();

    expect(callStack).toMatchObject([]);

    emitter.second();

    await vi.runAllTimersAsync();

    expect(callStack).toMatchObject(['first', 'second']);
  });

  it('Initializes if an initialize method is present.', async () => {
    const callStack: Array<string> = [];

    const first = vi.fn(() => callStack.push('first'));

    const initialize = vi.fn(() => callStack.push('initialize'));

    const emitter = createEmitter({
      first,
      initialize,
    });

    await emitter.initialize();

    await emitter.first();

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(callStack).toMatchObject(['initialize', 'first']);
  });

  it('Can call initialize explicitly.', async () => {
    const callStack: Array<string> = [];

    const initialize = vi.fn(() => callStack.push('initialize'));

    const emitter = createEmitter({
      initialize,
    });

    await emitter.initialize();

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(callStack).toMatchObject(['initialize']);
  });

  it('Prevents initialize from being called multiple times.', async () => {
    const callStack: Array<string> = [];

    const initialize = async () => callStack.push('initialize');

    const emitter = createEmitter({ initialize });

    await emitter.initialize();

    expect(callStack).toMatchObject(['initialize']);

    await expect(emitter.initialize()).rejects.toThrow('initialize() can only be called once.');

    expect(callStack).toMatchObject(['initialize']);
  });

  it('Exposes a getter to confirm enabled state.', async () => {
    const first = async () => {};

    const initialize = async () => {};

    const emitter = createEmitter({
      first,
      initialize,
    });

    await emitter.initialize();

    expect(emitter.enabled).toEqual(true);

    emitter.disable();

    expect(emitter.enabled).toEqual(false);
  });

  it('Exposes a getter to confirm flushing state.', async () => {
    const first = async () => new Promise<void>((resolve) => setTimeout(resolve, 1000));

    const initialize = async () => {};

    const emitter = createEmitter({
      first,
      initialize,
    });

    emitter.initialize();
    emitter.first();

    expect(emitter.flushing).toEqual(true);

    await vi.runAllTimersAsync();

    expect(emitter.flushing).toEqual(false);
  });

  it('If an async function is flushing, we wait until its done before unsubscribing.', async () => {
    const first = async () => new Promise<void>((resolve) => setTimeout(resolve, 1000));

    const emitter = createEmitter({ first });

    const unsubscribe = emitter.subscribe({ first: vi.fn(async () => {}) });

    emitter.first();

    unsubscribe();

    expect(emitter.flushing).toEqual(true);
    expect(Object.getOwnPropertySymbols(emitter.__SUBSCRIPTIONS__).length).toBe(1);

    await vi.runAllTimersAsync();

    expect(emitter.flushing).toEqual(false);
    expect(Object.keys(emitter.__SUBSCRIPTIONS__).length).toBe(0);
  });

  it('Exposes a getter to confirm initialized state.', async () => {
    const first = async () => {};

    const initialize = async () => {};

    const emitter = createEmitter({
      first,
      initialize,
    });

    expect(emitter.initialized).toEqual(false);

    await emitter.initialize();

    await emitter.first();

    expect(emitter.initialized).toEqual(true);
  });

  it('Rejects if a method throws.', async () => {
    const emitter = createEmitter({
      async first() {
        throw new Error(':(');
      },
    });

    await expect(emitter.first()).rejects.toThrow(':(');
  });

  it('Adds a subscription.', async () => {
    const emitter = createEmitter({
      async first() {},
    });

    const first = vi.fn();

    emitter.subscribe({ first });

    await emitter.first();

    expect(first).toHaveBeenCalledTimes(1);
  });

  it('Adds multiple subscriptions.', async () => {
    const emitter = createEmitter({
      async first() {},
    });

    const first = vi.fn();

    emitter.subscribe({ first });
    emitter.subscribe({ first });

    await emitter.first();

    expect(first).toHaveBeenCalledTimes(2);
  });

  it('Subscribes to all events.', async () => {
    const emitter = createEmitter({
      async first() {},
      async second() {},
      async third() {},
    });

    const all = vi.fn();

    emitter.subscribe({ all });

    await emitter.first();
    await emitter.second();
    await emitter.third();

    expect(all).toHaveBeenCalledTimes(3);
  });

  it('Only cancels subscriptions of thrown methods.', async () => {
    const emitter = createEmitter({
      async first() {
        throw new Error(':(');
      },
      async second() {},
    });

    const first = vi.fn();
    const second = vi.fn();

    emitter.subscribe({ first });
    emitter.subscribe({ second });

    await expect(emitter.first()).rejects.toThrow();

    await emitter.second();

    expect(first).toHaveBeenCalledTimes(0);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('Unsubscribes from a method.', async () => {
    const emitter = createEmitter({
      async first() {},
    });

    const first = vi.fn();

    const unsubscribe = emitter.subscribe({ first });

    await emitter.first();

    expect(first).toHaveBeenCalledTimes(1);

    unsubscribe();

    await emitter.first();

    expect(first).toHaveBeenCalledTimes(1);
  });

  it('Throwing from within a subscription does not interrupt execution.', async () => {
    const emitter = createEmitter({
      first: () => {},
    });

    const first = vi.fn(() => {
      throw new Error(':(');
    });

    emitter.subscribe({ first });

    expect(() => emitter.first()).not.toThrow(':(');
  });

  it('Supports subscribing to initialize()', async () => {
    const emitter = createEmitter({
      async initialize() {},
    });

    const initialize = vi.fn();

    emitter.subscribe({ initialize });

    await emitter.initialize();

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('Supports enabling/disabling for subscriptions', async () => {
    const emitter = createEmitter({
      async first() {},
    });

    emitter.disable();

    const first = vi.fn();

    emitter.subscribe({ first });

    await emitter.first();

    expect(first).toHaveBeenCalledTimes(0);

    emitter.enable();

    await emitter.first();

    expect(first).toHaveBeenCalledTimes(1);
  });
});
