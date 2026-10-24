import { sendData } from "../../lib/response.js";
import {
  cancelPayment,
  createPayment,
  getPayment,
  getPaymentSummary,
  getPaymentTimeline,
  listPayments,
} from "./payment.service.js";

export async function create(req, res, next) {
  try {
    const result = await createPayment({
      auth: req.auth,
      body: req.validated.body,
      req,
    });
    sendData(req, res, result.payment, result.status ?? 201);
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const result = await listPayments({
      auth: req.auth,
      query: req.validated.query ?? {},
    });
    sendData(req, res, result.payments, 200);
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const payment = await getPayment({
      auth: req.auth,
      paymentId: req.validated.params.paymentId,
    });
    sendData(req, res, payment, 200);
  } catch (error) {
    next(error);
  }
}

export async function timeline(req, res, next) {
  try {
    const result = await getPaymentTimeline({
      auth: req.auth,
      paymentId: req.validated.params.paymentId,
    });
    sendData(req, res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function summary(req, res, next) {
  try {
    const result = await getPaymentSummary({ auth: req.auth });
    sendData(req, res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    const result = await cancelPayment({
      auth: req.auth,
      paymentId: req.validated.params.paymentId,
      req,
    });
    sendData(req, res, result.payment, 200);
  } catch (error) {
    next(error);
  }
}
