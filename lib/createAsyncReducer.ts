/* eslint-disable @typescript-eslint/no-explicit-any */
import { AsyncThunk, createReducer } from '@reduxjs/toolkit';
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer';
import { TypedActionCreator } from '@reduxjs/toolkit/dist/mapBuilders';

export type AsyncReducerStateMeta<T extends AsyncThunk<any, any, any>> =
    | ReturnType<T['fulfilled']>['meta']
    | ReturnType<T['pending']>['meta']
    | ReturnType<T['rejected']>['meta']
    | {
        requestStatus: 'initial';
    };

export type AsyncReducerResult<T extends AsyncThunk<any, any, any>> = ReturnType<T['fulfilled']>['payload'];

export type AsyncReducerState<T extends AsyncThunk<any, any, any>> = {
    error?: unknown;
    meta: AsyncReducerStateMeta<T>;
    result?: AsyncReducerResult<T>;
};

export function createAsyncReducer<T extends AsyncThunk<any, any, any>>(
    thunk: T,
): ReducerWithInitialState<AsyncReducerState<T>>;
export function createAsyncReducer<T extends AsyncThunk<any, any, any>, A extends TypedActionCreator<string>>(
    thunk: T,
    clearAction: A,
): ReducerWithInitialState<AsyncReducerState<T>>;
export function createAsyncReducer<T extends AsyncThunk<any, any, any>, A extends TypedActionCreator<string>>(
    thunk: T,
    clearAction?: A,
): ReducerWithInitialState<AsyncReducerState<T>> {
    return createReducer<AsyncReducerState<T>>(
        // Create initial state
        {
            meta: {
                requestStatus: 'initial',
            },
        },
        // Construct reducer
        (builder) => {
            // Add fulfilled action
            builder.addCase(thunk.fulfilled, (state, action) => {
                // Ensure the current request has status 'pending' and it matches the response in the action
                if (state.meta.requestStatus !== 'pending' || state.meta.requestId !== action.meta.requestId) {
                    return;
                }

                return {
                    meta: action.meta,
                    result: action.payload,
                };
            });

            // Add pending action
            builder.addCase(thunk.pending, (_, action) => ({
                meta: action.meta,
            }));

            // Add rejected action
            builder.addCase(thunk.rejected, (state, action) => {
                // Skip checks if we are receiving a condition error
                if (!action.meta.condition) {
                    // Ensure the current request has status 'pending' and it matches the response in the action
                    if (state.meta.requestStatus !== 'pending' || state.meta.requestId !== action.meta.requestId) {
                        return;
                    }
                }
                
                // Save error and metadata
                const returnable: AsyncReducerState<T> = {
                    error: action.error,
                    meta: action.meta,
                };

                // Save value to result if thunk was rejectedWithValue
                if (action.meta.rejectedWithValue) {
                    returnable.result = action.payload;
                }

                // Pass state to store
                return returnable;
            });

            // Add clear action to reset the reducer to its initial state if one was provided
            if (clearAction) {
                builder.addCase(clearAction, () => ({
                    meta: {
                        requestStatus: 'initial',
                    },
                }));
            }
        },
    );
}
