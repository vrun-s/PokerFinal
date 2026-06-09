/**
 * Represents the outcome of an operation that can succeed (ok: true) or fail (ok: false).
 */
export type Result<T, E> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: E;
};
