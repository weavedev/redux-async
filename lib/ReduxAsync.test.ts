import { applyMiddleware, combineReducers, createStore, Store } from 'redux';
import reduxSaga, { SagaIterator, SagaMiddleware } from 'redux-saga';
import { call } from 'redux-saga/effects';
import { ReduxAsync } from './ReduxAsync';

type ConsoleType = 'error' | 'group' | 'groupCollapsed' | 'groupEnd' | 'log' | 'warn';
type ConsoleMessage = [ConsoleType, ...any[]];
type ConsoleReport = ConsoleMessage[];

const wrapConsole: (() => (() => ConsoleReport)) = (): (() => ConsoleReport) => {
    const report: ConsoleReport = [];
    const { error, group, groupCollapsed, groupEnd, log, warn }: typeof console = console;

    const reporter: ((k: ConsoleType) => ((...m: any[]) => void)) = (k: ConsoleType): ((...m: any[]) => void) => (...m: any[]): void => {
        report.push([k, ...m]);
    };

    console.error = reporter('error');
    console.group = reporter('group');
    console.groupCollapsed = reporter('groupCollapsed');
    console.groupEnd = reporter('groupEnd');
    console.log = reporter('log');
    console.warn = reporter('warn');

    return (): ConsoleReport => {
        console.error = error;
        console.group = group;
        console.groupCollapsed = groupCollapsed;
        console.groupEnd = groupEnd;
        console.log = log;
        console.warn = warn;

        return report;
    };
};

let c: ReduxAsync<'cT', 'cC', 'cE', () => Promise<string>>;
let e: ReduxAsync<'eT', 'eC', 'eE', (i: number, j: number, k: boolean) => Promise<string>>;
let f: ReduxAsync<'fT', 'fC', 'fE', (i: number, j: number, k: boolean) => Promise<string>>;
let n: ReduxAsync<'nT', 'nC', 'nE', (i: number, j: number, k: boolean) => Promise<string>>;
let t: ReduxAsync<'tT', 'tC', 'tE', () => Promise<string>>;
let store: Store<{
    c: typeof c.state;
    e: typeof e.state;
    f: typeof f.state;
    n: typeof n.state;
    t: typeof t.state;
}>;
let sagaMiddleware: SagaMiddleware;

beforeEach(() => {
    c = new ReduxAsync('cT', 'cC', 'cE', async (): Promise<string> => {
        const a: {[key: string]: any} = { circular: 'error' };
        a.self = a;

        throw a;
    });
    e = new ReduxAsync('eT', 'eC', 'eE', async (i: number, j: number, k: boolean): Promise<string> => {
        return new Promise((_: ((value: string) => void), reject: ((value: any) => void)): void => {
            setTimeout(() => {
                reject(Error(`${i} ${j} ${k}`));
            }, 50);
        });
    });
    f = new ReduxAsync('fT', 'fC', 'fE', async (i: number, j: number, k: boolean): Promise<string> => {
        return new Promise((_: ((value: string) => void), reject: ((value: any) => void)): void => {
            setTimeout(() => {
                reject({ custom: 'rejection', with: [i, j, k] });
            }, 50);
        });
    });
    n = new ReduxAsync('nT', 'nC', 'nE', async (i: number, j: number, k: boolean): Promise<string> => {
        return new Promise((resolve: ((value: string) => void)): void => {
            setTimeout(() => {
                resolve(`${i} ${j} ${k}`);
            }, 50);
        });
    });
    t = new ReduxAsync('tT', 'tC', 'tE', async (): Promise<string> => {
        throw 4;
    });
    sagaMiddleware = reduxSaga();
    store = createStore(
        combineReducers({
            c: c.reducer,
            e: e.reducer,
            f: f.reducer,
            n: n.reducer,
            t: t.reducer,
        }),
        applyMiddleware(sagaMiddleware),
    );
    sagaMiddleware.run(c.saga);
    sagaMiddleware.run(e.saga);
    sagaMiddleware.run(f.saga);
    sagaMiddleware.run(n.saga);
    sagaMiddleware.run(t.saga);
});

test('Should throw when accessing .actions', () => {
    expect(() => {
        console.log(n.actions, 'never');
    }).toThrowError();
});

test('Should save parameters to query on run', () => {
    expect(store.getState().n.query).toBeUndefined();
    store.dispatch(n.run(7, 11, true));
    expect(store.getState().n.busy).toEqual(true);
    expect(store.getState().n.query).toEqual([7, 11, true]);
});

test('Should runSaga on store', () => {
    sagaMiddleware.run(n.runSaga, 13, 17, false);
    expect(store.getState().n.busy).toEqual(true);
    expect(store.getState().n.query).toEqual([13, 17, false]);
});

test('Should save result to data on return', (done: () => void) => {
    expect(store.getState().n.data).toBeUndefined();
    store.dispatch(n.run(19, 23, true));
    expect(store.getState().n.data).toBeUndefined();
    setTimeout(() => {
        expect(store.getState().n.data).toEqual('19 23 true');
        done();
    }, 80);
});

test('Should save Error to error as message and stack', (done: () => void) => {
    expect(store.getState().e.error).toBeUndefined();
    store.dispatch(e.run(1, 3, true));
    expect(store.getState().e.error).toBeUndefined();
    setTimeout(() => {
        expect((<{message: any}>store.getState().e.error).message).toEqual('1 3 true');
        expect((<{stack: any}>store.getState().e.error).stack).toContain('Error: 1 3 true');
        done();
    }, 80);
});

test('Should save custom rejection to error', (done: () => void) => {
    expect(store.getState().f.error).toBeUndefined();
    store.dispatch(f.run(17, 31, true));
    expect(store.getState().f.error).toBeUndefined();
    setTimeout(() => {
        expect(store.getState().f.error).toEqual({
            custom: 'rejection',
            with: [17, 31, true],
        });
        done();
    }, 80);
});

test('Should save thrown errors to error', (done: () => void) => {
    expect(store.getState().t.error).toBeUndefined();
    store.dispatch(t.run());
    expect(store.getState().t.error).toBeUndefined();
    setTimeout(() => {
        expect(store.getState().t.error).toEqual(4);
        done();
    }, 80);
});

test('Should catch errors that can\'t be parsed to console and report a generic error', (done: () => void) => {
    const reporter: () => ConsoleReport = wrapConsole();

    expect(store.getState().c.error).toBeUndefined();
    store.dispatch(c.run());
    expect(store.getState().c.error).toBeUndefined();
    setTimeout(() => {
        expect(store.getState().c.error).toEqual('Error: see console');
        const report: ConsoleReport = reporter();

        expect(report[0]).toEqual(['group', 'Error in ReduxAsync']);
        expect(report[1][0]).toEqual('warn');
        expect(report[1][1]).toEqual('Could not parse error');
        expect(report[1][2] instanceof Error).toEqual(true);
        expect(report[2][0]).toEqual('error');
        expect(report[2][1]).toEqual('Caught a complex error from: cT');
        expect((<{[key: string]: any}>report[2][2]).circular).toEqual('error');
        expect((<{[key: string]: any}>report[2][2]).self).toEqual(report[2][2]);
        expect(report[3]).toEqual(['groupEnd']);
        done();
    }, 80);
});

test('RunSaga should return result', (done: () => void) => {
    let result: typeof n.state;

    sagaMiddleware.run(function* (): SagaIterator {
        result = <typeof n.state>(yield call(n.runSaga, 13, 17, false));
    });

    setTimeout(() => {
        expect(result.data).toEqual('13 17 false');
        expect(result.error).toBeUndefined();
        expect(result.query).toEqual([13, 17, false]);
        done();
    }, 80);
});

test('RunSaga should return error', (done: () => void) => {
    let result: typeof t.state;

    sagaMiddleware.run(function* (): SagaIterator {
        result = <typeof t.state>(yield call(t.runSaga));
    });

    setTimeout(() => {
        expect(result.data).toBeUndefined();
        expect(result.error).toEqual(4);
        expect(result.query).toEqual([]);
        done();
    }, 80);
});
