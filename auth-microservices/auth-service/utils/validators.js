// 📁 auth-service/utils/validators.js
const Joi = require('joi');

// Validador para login
const loginValidator = Joi.object({
  username: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'El username debe tener al menos 3 caracteres',
      'string.max': 'El username no puede exceder 100 caracteres',
      'any.required': 'El username es requerido'
    }),
  
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 6 caracteres',
      'any.required': 'La contraseña es requerida'
    }),
  
  application: Joi.string()
    .optional()
    .allow('')
    .messages({
      'string.base': 'La aplicación debe ser una cadena de texto'
    })
});

module.exports = {
  loginValidator
};