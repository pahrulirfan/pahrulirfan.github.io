// src/validators/auth.validator.js
import Joi from 'joi';

export const skemaAuth = Joi.object({
    email:    Joi.string().email().max(100).required(),
    password: Joi.string().min(8).max(72).required()
});
