import mongoose from "mongoose";

export async function runInTransaction(work) {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export function isUnknownCommitResult(error) {
  return Boolean(error?.hasErrorLabel?.("UnknownTransactionCommitResult"));
}

export function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runFinancialTransaction(work, { reconcile } = {}) {
  try {
    return await runInTransaction(work);
  } catch (error) {
    if (
      (isUnknownCommitResult(error) || isDuplicateKeyError(error)) &&
      reconcile
    ) {
      // A concurrent writer may have won the unique source-event index. Poll
      // briefly for the committed result rather than retrying a financial
      // action blindly. The caller's unique source constraint remains the
      // exactly-once guard if the result is still not visible.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const committedResult = await reconcile();
        if (committedResult) return committedResult;
        await delay(25 * (attempt + 1));
      }
    }
    throw error;
  }
}
