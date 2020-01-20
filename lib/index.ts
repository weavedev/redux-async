import { Action, Reducer } from 'redux';
import { Saga } from 'redux-saga';
import { call, CallEffect, ForkEffect, put, PutEffect, race, take, takeLatest } from 'redux-saga/effects';

type PromiseReturnType<Fn extends (...args: any[]) => Promise<any>> = Parameters<ReturnType<Fn>['then']>[0];

interface TriggerAction<T, Fn extends (...args: any[]) => Promise<any>> extends Action<T> {
    query: Parameters<Fn>;
}

interface CallbackAction<T, Fn extends (...args: any[]) => Promise<any>> extends Action<T> {
    data: PromiseReturnType<Fn>;
}

interface ErrorAction<T> extends Action<T> {
    error: any;
}

type Actions<T, C, E, Fn extends (...args: any[]) => Promise<any>> = TriggerAction<T, Fn>
    | CallbackAction<C, Fn>
    | ErrorAction<E>;

interface State<Fn extends (...args: any[]) => Promise<any>> {
    busy: boolean;
    error?: any;
    data?: PromiseReturnType<Fn>;
    query?: Parameters<Fn>;
    updated: {
        data?: string;
        error?: string;
        query?: string;
        reset: string;
    };
}

type RequestSagaResultType<C, E, Fn extends (...args: any[]) => Promise<any>> = [ErrorAction<E>, CallbackAction<C, Fn>];

/**
 * Typed redux async class that generates actions, reducer and saga.
 */
export class ReduxAsync<T extends string, C extends string, E extends string, Fn extends (...args: any[]) => Promise<any>> {
    private readonly triggerActionType: T;
    private readonly callbackActionType: C;
    private readonly errorActionType: E;

    private readonly job: Fn;

    constructor(trigger: T, callback: C, error: E, job: Fn) {
        this.triggerActionType = trigger;
        this.callbackActionType = callback;
        this.errorActionType = error;
        this.job = job;
    }

    public get actions(): Actions<T, C, E, Fn> {
        throw new Error('ReduxAsync.actions should only be used as a TypeScript type provider');
    }

    public get state(): State<Fn> {
        return {
            busy: false,
            updated: {
                reset: new Date().toISOString(),
            },
        };
    }

    public get reducer(): Reducer<State<Fn>> {
        const context: ReduxAsync<T, C, E, Fn> = this;

        return (s: State<Fn> = context.state, action: Action): State<Fn> => {
            switch(action.type) {
                case (context.triggerActionType):
                    return {
                        ...s,
                        busy: true,
                        query: (<TriggerAction<T, Fn>>action).query,
                        updated: { ...s.updated, query: new Date().toISOString() },
                    };
                case (context.callbackActionType):
                    return {
                        ...s,
                        busy: false,
                        data: (<CallbackAction<C, Fn>>action).data,
                        updated: { ...s.updated, data: new Date().toISOString() },
                    };
                case (context.errorActionType):
                    return {
                        ...s,
                        busy: false,
                        error: (<ErrorAction<E>>action).error,
                        updated: { ...s.updated, error: new Date().toISOString() },
                    };
                default:
                    return s;
            }
        };
    }

    public get saga(): Saga<any> {
        const context: ReduxAsync<T, C, E, Fn> = this;

        return function* (): IterableIterator<ForkEffect> {
            yield takeLatest(
                context.triggerActionType,
                function* (action: TriggerAction<T, Fn>): IterableIterator<CallEffect | PutEffect> {
                    try {
                        // Wrapping async function in an async function because in some cases redux-saga destroys `this`
                        const result: PromiseReturnType<Fn> = <PromiseReturnType<Fn>>(yield call(
                            async (): Promise<PromiseReturnType<Fn>> => {
                                return context.job(...action.query);
                            },
                        ));
                        yield put({
                            type: context.callbackActionType,
                            data: result,
                        });
                    } catch (error) {
                        if (error instanceof Error) {
                            yield put({
                                type: context.errorActionType,
                                error: Object.getOwnPropertyNames(error).reduce(
                                    (a: {[key: string]: any}, k: string): {[key: string]: any} => ({
                                        ...a, [k]: (<{[key: string]: any}>error)[k],
                                    }),
                                    {},
                                ),
                            });
                        } else if (error !== Object(error)) {
                            // Primitive
                            yield put({ type: context.errorActionType, error });
                        } else {
                            console.error(`Caught a complex error from: ${context.triggerActionType}`, error);

                            yield put({ type: context.errorActionType, error });
                        }
                    }
                },
            );
        };
    }

    public run(...i: Parameters<Fn>): TriggerAction<T, Fn> {
        return {
            type: this.triggerActionType,
            query: i,
        };
    }

    public get runSaga(): (...i: Parameters<Fn>) => any {
        const context: ReduxAsync<T, C, E, Fn> = this;

        return function* (...i: Parameters<Fn>): any {
            // Generate request
            const request: TriggerAction<T, Fn> = context.run(...i);

            // Fire request
            yield put(request);

            // Wait for a response
            const [failure, success]: RequestSagaResultType<C, E, Fn> = <RequestSagaResultType<C, E, Fn>>(yield race([
                take(context.errorActionType),
                take(context.callbackActionType),
            ]));

            // Simulate the next store state
            return context.reducer(context.reducer(undefined, request), failure || success);
        };
    }
}
