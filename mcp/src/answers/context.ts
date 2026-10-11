/** What an answer needs: the checkout it reads. Nothing here writes into it. */
export interface Context {
  /** the repository root */
  root: string;
}

/** An answer: the structured result, and a line for a client that shows text only. */
export interface Answer<T> {
  result: T;
  note?: string;
}
