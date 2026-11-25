// src/middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
    const status = err.status ?? 500;

    if (status >= 500) console.error(err);   // hanya error server yang dicatat lengkap

    res.status(status).json({
        error: {
            pesan: status < 500 ? err.message : 'Terjadi kesalahan pada server',
            kode: err.kode ?? (status < 500 ? 'REQUEST_ERROR' : 'INTERNAL_ERROR')
        }
    });
}
