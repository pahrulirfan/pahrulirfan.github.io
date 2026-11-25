// src/data/user.data.js
import { prisma } from '../lib/prisma.js';

export function cariByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
}

export function simpan({ email, passwordHash }) {
    return prisma.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true, role: true },   // passwordHash tidak ikut dikembalikan
    });
}
