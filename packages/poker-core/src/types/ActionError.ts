export type ActionErrorCode =
  | "NOT_PLAYER_TURN"
  | "PLAYER_NOT_ACTIVE"
  | "INVALID_CHECK"
  | "INVALID_CALL"
  | "INVALID_RAISE_AMOUNT"
  | "RAISE_NOT_ALLOWED"
  | "INSUFFICIENT_STACK"
  | "INVALID_ACTION";

/**
 * Represents a validation error when processing a game action.
 */
export interface ActionError {
  readonly code: ActionErrorCode;
  readonly message: string;
}
