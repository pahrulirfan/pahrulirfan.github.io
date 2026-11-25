// src/middleware/notFound.js
import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
    next(new AppError(404, `Rute ${req.method} ${req.originalUrl} tidak ada`, 'ROUTE_NOT_FOUND'));
}
