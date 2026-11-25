// src/validators/pendaftaran.validator.js
import Joi from 'joi';

export const skemaPendaftaran = Joi.object({
    mahasiswaId: Joi.number().integer().positive().required(),
    kelasId:     Joi.number().integer().positive().required()
});
