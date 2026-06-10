export type PokerErrorCode =
  | "INVALID_DEAL_COUNT"
  | "INSUFFICIENT_CARDS"
  | "EMPTY_DECK"
  | "INVALID_CARD_SERIALIZATION"
  | "INVALID_ARGUMENT"
  | "INVALID_HAND_SIZE"
  | "RAISE_NOT_ALLOWED"
  | "INSUFFICIENT_STACK"
  | "INVALID_BEST_HAND_SIZE"
  | "INVALID_COMBINATION_PARAMS";

export class PokerError extends Error {
  constructor(
    public readonly code: PokerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PokerError";
    // Maintain correct stack trace in environments supporting it (V8, etc.)
    const anyError = Error as any;
    if (typeof anyError.captureStackTrace === "function") {
      anyError.captureStackTrace(this, PokerError);
    }
  }
}
