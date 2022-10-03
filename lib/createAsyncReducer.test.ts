import 'mocha';
import { configureStore, createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { expect } from 'chai';
import { createAsyncReducer } from './createAsyncReducer';

function meta<T extends ({ requestId?: string } | {})>(m: T): Omit<T, 'requestId'> {
    if ((<{ requestId?: string }>m).requestId === undefined) {
        return m;
    }

    const { requestId, ...returnable } = (<{ requestId?: string }>m);

    return <Omit<T, 'requestId'>>returnable;
}

describe('createAsyncReducer', () => {
    describe('setting default state on the store', () => {
        it('should work as a root reducer', () => {
            const store = configureStore({
                reducer: createAsyncReducer(
                    createAsyncThunk(
                        'test/thunk',
                        async () => 1,
                    ),
                ),
            });

            expect(store.getState()).to.deep.equal({
                meta: {
                    requestStatus: 'initial',
                },
            });
        });

        it('should work as a mapped reducer', async () => {
            const store = configureStore({
                reducer: {
                    child: createAsyncReducer(
                        createAsyncThunk(
                            'test/thunk',
                            async () => 1,
                        ),
                    ),
                },
            });

            expect(store.getState()).to.deep.equal({ child: { meta: { requestStatus: 'initial' } } });
        });
    });

    it('should write success data from a resolved promise', (done) => {    
        const thunk = createAsyncThunk(
            'test/thunk',
            async () => Promise.resolve('happy'),
        );
        const store = configureStore({ reducer: createAsyncReducer(thunk) });

        // Count store updates
        let count = 0;
        const unsubscribe = store.subscribe(() => {
            count++;

            expect(store.getState().meta.requestStatus).to.be.oneOf([ 'fulfilled', 'pending' ]);

            if (store.getState().meta.requestStatus === 'fulfilled') {
                expect(count).to.equal(2);
                expect(store.getState().result).to.equal('happy');
                expect(meta(store.getState().meta)).to.deep.equal({
                    arg: undefined,
                    requestStatus: 'fulfilled',
                });

                unsubscribe();
                done();
            }
        });

        // Trigger thunk
        store.dispatch(thunk());
    });

    it('should write error data from a thrown promise', (done) => {
        const thunk = createAsyncThunk(
            'test/thunk',
            async () => Promise.reject('sad'),
        );
        const store = configureStore({ reducer: createAsyncReducer(thunk) });

        // Count store updates
        let count = 0;
        const unsubscribe = store.subscribe(() => {
            count++;

            expect(store.getState().meta.requestStatus).to.be.oneOf([ 'pending', 'rejected' ]);

            if (store.getState().meta.requestStatus === 'rejected') {
                expect(count).to.equal(2);
                expect(store.getState().error).to.deep.equal({ message: 'sad' });
                expect(meta(store.getState().meta)).to.deep.equal({
                    arg: undefined,
                    rejectedWithValue: false,
                    requestStatus: 'rejected',
                    aborted: false,
                    condition: false,
                });

                unsubscribe();
                done();
            }
        });

        // Trigger thunk
        store.dispatch(thunk());
    });

    it('should write error data from an API rejected promise with value', (done) => {
        const thunk = createAsyncThunk(
            'test/thunk',
            async (_, thunkAPI) => thunkAPI.rejectWithValue('confused'),
        );
        const store = configureStore({ reducer: createAsyncReducer(thunk) });

        // Count store updates
        let count = 0;
        const unsubscribe = store.subscribe(() => {
            count++;

            expect(store.getState().meta.requestStatus).to.be.oneOf([ 'pending', 'rejected' ]);

            if (store.getState().meta.requestStatus === 'rejected') {
                expect(count).to.equal(2);
                expect(store.getState().result).to.equal('confused');
                expect(store.getState().error).to.deep.equal({ message: 'Rejected' });
                expect(meta(store.getState().meta)).to.deep.equal({
                    arg: undefined,
                    rejectedWithValue: true,
                    requestStatus: 'rejected',
                    aborted: false,
                    condition: false,
                });

                unsubscribe();
                done();
            }
        });

        // Trigger thunk
        store.dispatch(thunk());
    });

    it('should be able to clear the reducer with a custom action', (done) => {
        const thunk = createAsyncThunk(
            'test/thunk',
            async () => Promise.resolve('happy'),
        );
        const clear = createAction('test/thunk/initial');
        const store = configureStore({ reducer: createAsyncReducer(thunk, clear) });

        // Count store updates
        let count = 0;
        const unsubscribe = store.subscribe(() => {
            count++;

            expect(store.getState().meta.requestStatus).to.be.oneOf([ 'fulfilled', 'pending', 'initial' ]);

            if (store.getState().meta.requestStatus === 'fulfilled') {
                expect(count).to.equal(2);
                expect(store.getState().result).to.equal('happy');
                expect(meta(store.getState().meta)).to.deep.equal({
                    arg: undefined,
                    requestStatus: 'fulfilled',
                });

                queueMicrotask(() => store.dispatch(clear()));
            }

            if (count === 3) {
                expect(store.getState()).to.deep.equal({
                    meta: {
                        requestStatus: 'initial',
                    },
                });

                unsubscribe();
                done();
            }
        });

        // Trigger thunk
        store.dispatch(thunk());
    })
});
