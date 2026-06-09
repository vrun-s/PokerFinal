export class PokerError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "PokerError";
        // Maintain correct stack trace in environments supporting it (V8, etc.)
        const anyError = Error;
        if (typeof anyError.captureStackTrace === "function") {
            anyError.captureStackTrace(this, PokerError);
        }
    }
}
