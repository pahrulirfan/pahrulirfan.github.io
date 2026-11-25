// src/middleware/validasi.js
import { AppError } from '../utils/AppError.js';

export const validasi = (skema) => (req, res, next) => {
    const { error, value } = skema.validate(req.body ?? {}, { abortEarly: false });

    if (error) {
        const pesan = error.details.map(d => d.message).join('; ');
        return next(new AppError(422, pesan, 'VALIDATION_ERROR'));
    }

    req.body = value;   // pakai nilai yang sudah dibersihkan Joi (termasuk nilai bawaan)
    next();
};
