import { SagaIterator } from '@redux-saga/types';
import { InternalReducer, Reduxable } from '@weavedev/reduxable';
import { Action } from 'redux';
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
    data: PromiseReturnType<Fn> | undefined;
    query?: Parameters<Fn>;
    updated: {
        data?: string;
        error?: string;
        query?: string;
    };
}

/**
 * Typed redux async class that generates actions, reducer and saga.
 */
export class ReduxAsync<
    T extends string,
    C extends string,
    E extends string,
    Fn extends (...args: any[]) => Promise<any>
> extends Reduxable<State<Fn>, Parameters<Fn>> {
    private readonly triggerActionType: T;
    private readonly callbackActionType: C;
    private readonly errorActionType: E;

    private readonly job: Fn;

    constructor(trigger: T, callback: C, error: E, job: Fn) {
        super();
        this.triggerActionType = trigger;
        this.callbackActionType = callback;
        this.errorActionType = error;
        this.job = job;
    }

    public get actions(): Actions<T, C, E, Fn> {
        throw new Error('ReduxAsync.actions should only be used as a TypeScript type provider');
    }

    public get defaultState(): State<Fn> {
        return {
            busy: false,
            data: undefined,
            updated: {},
        };
    }

    protected get internalReducer(): InternalReducer<State<Fn>> {
        const context: ReduxAsync<T, C, E, Fn> = this;

        return (state: State<Fn>, action: Action): State<Fn> => {
            switch(action.type) {
                case (context.triggerActionType):
                    return {
                        busy: true,
                        data: undefined,
                        query: (<TriggerAction<T, Fn>>action).query,
                        updated: {
                            query: new Date().toISOString(),
                        },
                    };
                case (context.callbackActionType):
                    return {
                        ...state,
                        busy: false,
                        data: (<CallbackAction<C, Fn>>action).data,
                        error: undefined,
                        updated: {
                            ...state.updated,
                            data: new Date().toISOString(),
                            error: undefined,
                        },
                    };
                case (context.errorActionType):
                    return {
                        ...state,
                        busy: false,
                        data: undefined,
                        error: (<ErrorAction<E>>action).error,
                        updated: {
                            ...state.updated,
                            data: undefined,
                            error: new Date().toISOString(),
                        },
                    };
                default:
                    return state;
            }
        };
    }

    public get saga(): (() => IterableIterator<ForkEffect>) {
        const context: ReduxAsync<T, C, E, Fn> = this;

        return function* (): IterableIterator<ForkEffect> {
            yield takeLatest(
                context.triggerActionType,
                function* (action: TriggerAction<T, Fn>): IterableIterator<CallEffect | PutEffect> {
                    try {
                        // Wrapping async function in an async function because in some cases redux-saga destroys `this`
                        yield put({
                            type: context.callbackActionType,
                            data: <PromiseReturnType<Fn>>(yield call(
                                async (): Promise<PromiseReturnType<Fn>> => context.job(...action.query),
                            )),
                        });
                    } catch (error) {
                        yield put(context.error(error));
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

    public get runSaga(): (...i: Parameters<Fn>) => SagaIterator<State<Fn>> {
        const context: ReduxAsync<T, C, E, Fn> = this;

        return function* (...i: Parameters<Fn>): SagaIterator<State<Fn>> {
            // Fire request
            yield put(context.run(...i));

            // Wait for a response
            yield race([
                take(context.errorActionType),
                take(context.callbackActionType),
            ]);

            // Simulate the next store state
            return context.state;
        };
    }

    private error(error: any): ErrorAction<E> {
        const returnable: ErrorAction<E> = { type: this.errorActionType, error: 'Error: see console' };

        if (error instanceof Error) {
            returnable.error = { message: error.message, name: error.name, stack: error.stack };
        } else if (error !== Object(error)) {
            returnable.error = error; // Primitive
        } else {
            try {
                returnable.error = JSON.parse(JSON.stringify(error));
            } catch (e) {
                console.error(`Error in ${this.triggerActionType}:`, error);
                console.warn('Was not able to write error to store:', e);
            }
        }

        return returnable;
    }
}
