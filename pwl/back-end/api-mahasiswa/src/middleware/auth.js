// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

export function butuhLogin(req, res, next) {
    const header = req.headers.authorization;             // "Bearer eyJhbGci..."

    if (!header?.startsWith('Bearer ')) {
        return next(new AppError(401, 'Token diperlukan', 'TOKEN_DIPERLUKAN'));
    }

    try {
        req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);   // { id, role, iat, exp }
        next();
    } catch (err) {
        next(new AppError(401, 'Token tidak valid atau expired', 'TOKEN_TIDAK_VALID'));
    }
}

export function butuhRole(...roleDiizinkan) {
    return (req, res, next) => {
        if (!roleDiizinkan.includes(req.user.role)) {
            return next(new AppError(403, 'Tidak punya izin untuk aksi ini', 'DILARANG'));
        }
        next();
    };
}
