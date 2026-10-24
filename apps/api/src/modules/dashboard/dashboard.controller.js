import { sendData } from "../../lib/response.js";
import {
  adminDashboard,
  developerDashboard,
  merchantDashboard,
  riskDashboard,
} from "./dashboard.service.js";

export async function merchant(req, res, next) {
  try {
    sendData(req, res, await merchantDashboard(req.auth), 200);
  } catch (error) {
    next(error);
  }
}

export async function admin(req, res, next) {
  try {
    sendData(
      req,
      res,
      await adminDashboard(req.auth, {
        database: req.app.locals.database,
      }),
      200,
    );
  } catch (error) {
    next(error);
  }
}

export async function developer(req, res, next) {
  try {
    sendData(req, res, await developerDashboard(req.auth), 200);
  } catch (error) {
    next(error);
  }
}

export async function risk(req, res, next) {
  try {
    sendData(req, res, await riskDashboard(req.auth), 200);
  } catch (error) {
    next(error);
  }
}
