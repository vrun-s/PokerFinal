export type PokerErrorCode = "INVALID_DEAL_COUNT" | "INSUFFICIENT_CARDS" | "EMPTY_DECK" | "INVALID_CARD_SERIALIZATION" | "INVALID_ARGUMENT" | "INVALID_HAND_SIZE" | "INVALID_BEST_HAND_SIZE" | "INVALID_COMBINATION_PARAMS";
export declare class PokerError extends Error {
    readonly code: PokerErrorCode;
    constructor(code: PokerErrorCode, message: string);
}
