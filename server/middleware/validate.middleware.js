function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details.map((detail) => detail.message).join(', '),
      });
    }
    req.body = value;
    next();
  };
}

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details.map((detail) => detail.message).join(', '),
      });
    }
    req.body = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details.map((detail) => detail.message).join(', '),
      });
    }
    req.query = value;
    next();
  };
}

module.exports = { validateBody, validateQuery };
