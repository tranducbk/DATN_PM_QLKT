/**
 * Asserts a promise rejects with the expected error class and (optionally) message.
 *
 * String matchers use **exact equality** (`message === pattern`) so regressions in
 * wording surface immediately. For partial matches use `RegExp` (e.g. `/^prefix:.+$/`).
 * `messageStartsWith` is a convenience for the very common prefix-then-details pattern
 * (e.g. `Phát hiện đề xuất trùng (...): <hoTen>: ...`).
 *
 * @param promise - Promise expected to reject
 * @param ErrorClass - Expected error constructor (instance check)
 * @param messagePattern - Exact string, RegExp, or `{ startsWith }` matcher
 * @returns The rejected error instance — useful when callers want to assert extra fields
 * @throws Error - When the promise resolves, throws a wrong class, or message does not match
 */
export async function expectError<E extends Error>(
  promise: Promise<unknown>,
  ErrorClass: new (...args: any[]) => E,
  messagePattern?: string | RegExp | { startsWith: string }
): Promise<E> {
  let resolved: unknown;
  let caught: unknown;
  try {
    resolved = await promise;
  } catch (err) {
    caught = err;
  }

  if (caught === undefined) {
    throw new Error(
      `Expected promise to reject with ${ErrorClass.name}, but it resolved with: ${JSON.stringify(resolved)}`
    );
  }

  if (!(caught instanceof ErrorClass)) {
    const actualName = (caught as Error)?.constructor?.name ?? typeof caught;
    const actualMessage = (caught as Error)?.message ?? String(caught);
    throw new Error(
      `Expected ${ErrorClass.name}, received ${actualName}. Message: ${actualMessage}`
    );
  }

  if (messagePattern !== undefined) {
    const message = caught.message ?? '';
    let matches: boolean;
    let descriptor: string;
    if (typeof messagePattern === 'string') {
      matches = message === messagePattern;
      descriptor = `equal "${messagePattern}"`;
    } else if (messagePattern instanceof RegExp) {
      matches = messagePattern.test(message);
      descriptor = `match ${String(messagePattern)}`;
    } else {
      matches = message.startsWith(messagePattern.startsWith);
      descriptor = `start with "${messagePattern.startsWith}"`;
    }
    if (!matches) {
      throw new Error(
        `Expected ${ErrorClass.name} message to ${descriptor}, got: ${message}`
      );
    }
  }

  return caught as E;
}
