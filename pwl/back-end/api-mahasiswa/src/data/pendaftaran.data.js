// src/data/pendaftaran.data.js
import { prisma } from '../lib/prisma.js';

export function semua() {
    return prisma.pendaftaran.findMany({
        include: { mahasiswa: true, kelas: true },
    });
}
