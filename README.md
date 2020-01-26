# redux-async

[![Build Status - Travis CI](https://img.shields.io/travis/weavedev/redux-async.svg)](https://travis-ci.org/weavedev/redux-async)
[![Test Coverage - Code Climate](https://img.shields.io/codeclimate/coverage/weavedev/redux-async.svg)](https://codeclimate.com/github/weavedev/redux-async/test_coverage)
[![GPL-3.0](https://img.shields.io/github/license/weavedev/redux-async.svg)](https://github.com/weavedev/redux-async/blob/master/LICENSE)
[![NPM](https://img.shields.io/npm/v/@weavedev/redux-async.svg)](https://www.npmjs.com/package/@weavedev/redux-async)

Async function wrapper for [Redux](http://redux.js.org/) powered by [Redux-Saga](https://redux-saga.js.org)

## Install

```
npm i @weavedev/redux-async
```

## API documentation

We generate API documentation with [TypeDoc](https://typedoc.org).

[![API Documentation](https://img.shields.io/badge/API-Documentation-blue?style=for-the-badge&logo=typescript)](https://weavedev.github.io/redux-async/)

## Usage

### Creating

In this example we create a reducer, saga and actions from an async function. This async function triggers its callback after 3 seconds.

```ts
import { ReduxAsync } from '@weavedev/redux-async';

const START_ACTION = 'START_ACTION';
const DONE_ACTION = 'DONE_ACTION';
const FAIL_ACTION = 'FAIL_ACTION';
export const asyncResource = new ReduxAsync(START_ACTION, DONE_ACTION, FAIL_ACTION, async (name: string): Promise<string> => {
    // This promise waits 3 seconds and then returns
    return new Promise((resolve: ((value: string) => void)): void => {
        setTimeout(() => {
            resolve(`Hey, ${name}!`);
        }, 3000);
    });
});

// If you are also using our store package (@weavedev/store)
window.storeReducers.asyncResource = asyncResource.reducer;
window.storeSagas.asyncResource = asyncResource.saga;

declare global {
    interface StoreReducersMap {
        asyncResource: typeof asyncResource.reducer;
    }

    interface StoreActionsMap {
        asyncResource: typeof asyncResource.actions;
    }
}
```

### Triggering

You can run your async function by calling `.run()`. The argument types will match those of your async function.

```ts
import { asyncResource } from './asyncResource';

// If you are also using our store package (@weavedev/store)
window.store.dispatch(asyncResource.run('Dave'));
```

### Use inside a saga

You can run and wait for results from your async function by calling `.runSaga()`. The argument types will match those of your async function. This can be useful when you need to run multiple async tasks in order.

```ts
function* mySaga(): Iterator<any> {
    const result = yield call(asyncResource.runSaga('Laura'));

    console.log("resource returned", result);
}
```

## License

[GPL-3.0](https://github.com/weavedev/redux-async/blob/master/LICENSE)

Made by [Paul Gerarts](https://github.com/gerarts) and [Weave](https://weave.nl)
