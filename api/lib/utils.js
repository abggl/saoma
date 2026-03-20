function formatLocalTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function success(data) {
  return {
    success: true,
    data: data
  };
}

function error(message, code = null) {
  const response = {
    success: false,
    errorMessage: message
  };
  if (code) {
    response.errorCode = code;
  }
  return response;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(200).end();
    return true;
  }
  return false;
}

function parseBody(req) {
  if (req.body) {
    return req.body;
  }
  return {};
}

module.exports = {
  formatLocalTime,
  success,
  error,
  setCorsHeaders,
  handleOptions,
  parseBody
};
