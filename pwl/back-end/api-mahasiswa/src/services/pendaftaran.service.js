// src/services/pendaftaran.service.js
import { prisma } from '../lib/prisma.js';
import * as data from '../data/pendaftaran.data.js';
import { AppError } from '../utils/AppError.js';

export async function daftarPendaftaran() {
    return data.semua();
}

export async function daftarKelas(mahasiswaId, kelasId) {
    try {
        return await prisma.$transaction(async (tx) => {
            const mahasiswa = await tx.mahasiswa.findUnique({ where: { id: mahasiswaId } });
            if (!mahasiswa) throw new AppError(404, 'Mahasiswa tidak ditemukan', 'MAHASISWA_NOT_FOUND');

            const kelas = await tx.kelas.findUnique({ where: { id: kelasId } });
            if (!kelas) throw new AppError(404, 'Kelas tidak ditemukan', 'KELAS_NOT_FOUND');
            if (kelas.kuota <= 0) throw new AppError(409, 'Kuota kelas sudah penuh', 'KUOTA_PENUH');

            const pendaftaran = await tx.pendaftaran.create({
                data: { mahasiswaId, kelasId },
            });

            await tx.kelas.update({
                where: { id: kelasId },
                data: { kuota: { decrement: 1 } },
            });

            return pendaftaran;
        });
    } catch (err) {
        if (err.code === 'P2002') {   // UNIQUE (mahasiswaId, kelasId) dilanggar
            throw new AppError(409, 'Mahasiswa sudah terdaftar di kelas ini', 'SUDAH_TERDAFTAR');
        }
        throw err;
    }
}
