// src/middleware/batasLogin.js
import rateLimit from 'express-rate-limit';

// Batasi percobaan login yang GAGAL per IP. Login yang berhasil tidak dihitung,
// supaya pengguna yang sah tidak terkunci saat sering masuk-keluar waktu pengembangan.
export const batasLogin = rateLimit({
    windowMs: 15 * 60 * 1000,                                  // 15 menit
    limit: Number(process.env.LOGIN_MAX_GAGAL) || 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: { pesan: 'Terlalu banyak percobaan login, coba lagi nanti', kode: 'TERLALU_BANYAK_PERCOBAAN' }
    }
});
