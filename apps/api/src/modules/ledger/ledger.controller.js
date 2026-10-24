import { sendData } from "../../lib/response.js";
import {
  executeIntegrityCheck,
  getIntegrityReport,
  listIntegrityReports,
} from "./integrity.service.js";
import {
  getAccount,
  getAccountEntries,
  getBalances,
  getJournal,
  getTrialBalance,
  listAccounts,
  listJournals,
} from "./ledger-query.service.js";

export async function accounts(req, res, next) {
  try {
    sendData(
      req,
      res,
      await listAccounts({
        merchantId: req.auth.merchantId,
        query: req.validated.query,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function account(req, res, next) {
  try {
    sendData(
      req,
      res,
      await getAccount({
        merchantId: req.auth.merchantId,
        accountId: req.validated.params.accountId,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function accountEntries(req, res, next) {
  try {
    sendData(
      req,
      res,
      await getAccountEntries({
        merchantId: req.auth.merchantId,
        accountId: req.validated.params.accountId,
        query: req.validated.query,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function journals(req, res, next) {
  try {
    sendData(
      req,
      res,
      await listJournals({
        merchantId: req.auth.merchantId,
        query: req.validated.query,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function journal(req, res, next) {
  try {
    sendData(
      req,
      res,
      await getJournal({
        merchantId: req.auth.merchantId,
        journalId: req.validated.params.journalId,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function balances(req, res, next) {
  try {
    sendData(
      req,
      res,
      await getBalances({
        merchantId: req.auth.merchantId,
        currency: req.validated.query.currency,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function trialBalance(req, res, next) {
  try {
    sendData(
      req,
      res,
      await getTrialBalance({
        merchantId: req.auth.merchantId,
        currency: req.validated.query.currency,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function runIntegrity(req, res, next) {
  try {
    const report = await executeIntegrityCheck({
      auth: req.auth,
      currency: req.validated.body.currency,
      requestId: req.requestId,
      req,
      config: req.app.locals.config,
    });
    sendData(req, res, report, 201);
  } catch (error) {
    next(error);
  }
}
export async function integrityReports(req, res, next) {
  try {
    sendData(
      req,
      res,
      await listIntegrityReports({
        auth: req.auth,
        query: req.validated.query,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
export async function integrityReport(req, res, next) {
  try {
    sendData(
      req,
      res,
      await getIntegrityReport({
        auth: req.auth,
        reportId: req.validated.params.reportId,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}
