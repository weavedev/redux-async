# redux-async

[![Build Status - Travis CI](https://img.shields.io/travis/weavedev/redux-async.svg)](https://travis-ci.org/weavedev/redux-async)
[![Test Coverage - Code Climate](https://img.shields.io/codeclimate/coverage/weavedev/redux-async.svg)](https://codeclimate.com/github/weavedev/redux-async/test_coverage)
[![MIT](https://img.shields.io/github/license/weavedev/redux-async.svg)](https://github.com/weavedev/redux-async/blob/master/LICENSE)
[![NPM](https://img.shields.io/npm/v/@weavedev/redux-async.svg)](https://www.npmjs.com/package/@weavedev/redux-async)

Default reducer with reset functionality for [Redux Toolkit's createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk)

## Install

```
npm i @weavedev/redux-async
```

## API documentation

We generate API documentation with [TypeDoc](https://typedoc.org).

[![API Documentation](https://img.shields.io/badge/API-Documentation-blue?style=for-the-badge&logo=typescript)](https://weavedev.github.io/redux-async/)

## Creating

In this example we create a reducer from a thunk. The async function inside the thunk will trigger its callback after 3 seconds.

```ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createAsyncReducer } from '@weavedev/redux-async';

// First, create the thunk with @reduxjs/toolkit's createAsyncThunk
//     Docs, see: https://redux-toolkit.js.org/api/createAsyncThunk
export const runSayHello = createAsyncThunk(
    'say/hello',
    async (name: string): Promise<string> => {
        // This promise waits 3 seconds and then returns
        return new Promise((resolve: ((value: string) => void)): void => {
            setTimeout(() => {
                resolve(`Hey, ${name}!`);
            }, 3000);
        });
    },
);

// Then create the reducer from the thunk
export const sayHello = createAsyncReducer(runSayHello);
```

## Triggering

You can run your async function by dispatching the thunk. If your `Promise` expects a parameter, you can pass it to the thunk.

```ts
import { runSayHello } from './runSayHello';
import { store } from './store';

// Dispatch the thunk on your store
store.dispatch(runSayHello('Dave'));
```

For more information, see [Redux Toolkit: createAsyncThunk - Overview](https://redux-toolkit.js.org/api/createAsyncThunk#overview).

## Resetting

If you pass an action as the second argument to `createAsyncReducer` the generated reducer will reset itself to its initial state when this action is dispatched.

If this is done while the thunk is `'pending'`, the corresponding `'rejected'` or `'fulfilled'` will be ignored (the thunk will still fire the action, but the state will not update).

```ts
import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { createAsyncReducer } from '@weavedev/redux-async';

// First, create the thunk with @reduxjs/toolkit's createAsyncThunk
//     Docs, see: https://redux-toolkit.js.org/api/createAsyncThunk
export const runSayHello = createAsyncThunk(
    'say/hello',
    async (name: string): Promise<string> => {
        // This promise waits 3 seconds and then returns
        return new Promise((resolve: ((value: string) => void)): void => {
            setTimeout(() => {
                resolve(`Hey, ${name}!`);
            }, 3000);
        });
    },
);

// Create a reset action
//     We suggest adding `/reset` or `/initial` after your thunk action string
export const resetSayHello = createAction('say/hello/reset');

// Then create the reducer from the thunk and the reset action
export const sayHello = createAsyncReducer(runSayHello, resetSayHello);
```

To reset the state on your reducer, simply dispatch the reset action

```ts
store.dispatch(resetSayHello());
```

## State

The state output contains the following fields

### `error?: any`

The reducer will contain the rejected or thrown value in the `error` field if the `Promise` has rejected / thrown. This value will be cleared if you dispatch the thunk again (or on reset).

### `result?: ThunkResult`

The reducer will contain the returned value in the `result` field if the `Promise` has resolved. This value will be cleared if you dispatch the thunk again (or on reset).

### `meta`

The `meta` field contains a copy of the data in the `meta` field in [Thunk's Promise Lifecycle Actions](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions).

For example; when pending the `meta` field contains the following values:

```ts
requestId: string;
arg: ThunkArg;
```

The `meta` field also contains the `requestStatus` with the current state of the thunk.

```ts
requestStatus: 'initial' | 'pending' | 'fulfilled' | 'rejected';
```

#### `meta.requestStatus: 'initial'`

This is the `requestStatus` in the reducer, or the state after the reset action has been dispatched.

#### `meta.requestStatus: 'pending'`

This is the `requestStatus` in reducer while we are waiting for the `Promise` to resolve (or `throw`).

You can implement a busy indicator by checking `meta.requestStatus === 'pending'`.

#### `meta.requestStatus: 'fulfilled'`

This is the `requestStatus` in the reducer after the `Promise` has resolved. The reducer will also contain the returned value in the `result` field.

#### `meta.requestStatus: 'rejected'`

This is the `requestStatus` in the reducer after the `Promise` has rejected / thrown. The reducer will also contain the rejected or thrown value in the `error` field.

## License

[MIT](https://github.com/weavedev/redux-async/blob/master/LICENSE)

Made by [Paul Gerarts](https://github.com/gerarts) and [Weave](https://weave.nl)
