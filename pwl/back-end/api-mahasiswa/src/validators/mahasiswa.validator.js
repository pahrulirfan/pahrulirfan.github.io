// src/validators/mahasiswa.validator.js
import Joi from 'joi';

export const skemaMahasiswa = Joi.object({
    nim:      Joi.string().length(9).required(),
    nama:     Joi.string().min(3).max(100).required(),
    ipk:      Joi.number().min(0).max(4).default(0),
    semester: Joi.number().integer().min(1).max(14).default(1)
});
