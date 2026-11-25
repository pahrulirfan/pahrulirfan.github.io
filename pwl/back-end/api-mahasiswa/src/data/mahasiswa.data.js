// src/data/mahasiswa.data.js
import { prisma } from '../lib/prisma.js';

export function daftar({ where, orderBy, skip, take }) {
    return prisma.mahasiswa.findMany({ where, orderBy, skip, take });
}

export function hitung(where) {
    return prisma.mahasiswa.count({ where });
}

export function cariById(id) {
    return prisma.mahasiswa.findUnique({ where: { id } });
}

export function cariByNim(nim) {
    return prisma.mahasiswa.findUnique({ where: { nim } });
}

export function simpan(input) {
    return prisma.mahasiswa.create({ data: input });
}

export function ubah(id, input) {
    return prisma.mahasiswa.update({ where: { id }, data: input });
}

export function hapus(id) {
    return prisma.mahasiswa.delete({ where: { id } });
}
