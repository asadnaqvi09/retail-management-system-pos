const Joi = require('joi');

const openSessionSchema = Joi.object({
  openingAmount: Joi.number().min(0).required(),
});

const closeSessionSchema = Joi.object({
  actualClosingAmount: Joi.number().min(0).required(),
  varianceNote: Joi.string().trim().allow('', null),
});

module.exports = {
  openSessionSchema,
  closeSessionSchema,
};
