const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().trim().lowercase().required(),
  password: Joi.string().min(1),
  pin: Joi.string().pattern(/^\d{4,6}$/),
  rememberMe: Joi.boolean().default(false),
}).xor('password', 'pin');

const forgotPasswordSchema = Joi.object({
  username: Joi.string().trim().lowercase().required(),
  recoveryCode: Joi.string().trim().required(),
  newPassword: Joi.string().min(6).required(),
});

const unlockSessionSchema = Joi.object({
  password: Joi.string().min(1),
  pin: Joi.string().pattern(/^\d{4,6}$/),
}).xor('password', 'pin');

module.exports = {
  loginSchema,
  forgotPasswordSchema,
  unlockSessionSchema,
};
