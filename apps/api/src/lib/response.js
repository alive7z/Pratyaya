export function responseMeta(requestId) {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}

export function sendData(req, res, data, statusCode = 200) {
  res.status(statusCode).json({
    data,
    meta: responseMeta(req.requestId),
  });
}
