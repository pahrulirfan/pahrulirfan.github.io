// src/services/auth.service.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as data from '../data/user.data.js';
import { AppError } from '../utils/AppError.js';

export async function register({ email, password }) {
    if (await data.cariByEmail(email)) {
        throw new AppError(409, 'Email sudah terdaftar', 'EMAIL_DUPLIKAT');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    return data.simpan({ email, passwordHash });
}

export async function login({ email, password }) {
    const user = await data.cariByEmail(email);
    const cocok = user && (await bcrypt.compare(password, user.passwordHash));

    if (!cocok) {
        throw new AppError(401, 'Email atau password salah', 'LOGIN_GAGAL');
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '2h' },
    );
    return { token };
}
