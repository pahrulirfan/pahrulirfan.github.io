// src/services/mahasiswa.service.js
import * as data from '../data/mahasiswa.data.js';
import { AppError } from '../utils/AppError.js';

const KOLOM_URUT = ['nama', 'nim', 'ipk', 'semester', 'createdAt'];

function ambilId(id) {
    const angka = Number(id);
    if (!Number.isInteger(angka)) {
        throw new AppError(400, 'id harus berupa bilangan bulat', 'ID_TIDAK_VALID');
    }
    return angka;
}

export async function daftarMahasiswa(query) {
    const { semester, ipkMin, cari, urutkan = 'nama', arah = 'asc' } = query;
    const halaman = Math.max(Number(query.halaman) || 1, 1);
    const ukuran = Math.min(Math.max(Number(query.ukuran) || 10, 1), 100);

    if (!KOLOM_URUT.includes(urutkan)) {
        throw new AppError(400, `urutkan harus salah satu dari: ${KOLOM_URUT.join(', ')}`, 'QUERY_TIDAK_VALID');
    }

    const where = {
        ...(semester && { semester: Number(semester) }),
        ...(ipkMin && { ipk: { gte: Number(ipkMin) } }),
        ...(cari && { nama: { contains: cari } }),
    };

    const [hasil, total] = await Promise.all([
        data.daftar({
            where,
            orderBy: { [urutkan]: arah === 'desc' ? 'desc' : 'asc' },
            skip: (halaman - 1) * ukuran,
            take: ukuran,
        }),
        data.hitung(where),
    ]);

    return {
        data: hasil,
        meta: { halaman, ukuran, total, totalHalaman: Math.ceil(total / ukuran) },
    };
}

export async function detailMahasiswa(id) {
    const m = await data.cariById(ambilId(id));
    if (!m) {
        throw new AppError(404, 'Mahasiswa tidak ditemukan', 'NOT_FOUND');
    }
    return m;
}

export async function buatMahasiswa(input) {
    if (await data.cariByNim(input.nim)) {
        throw new AppError(409, `NIM ${input.nim} sudah terdaftar`, 'NIM_DUPLIKAT');
    }
    return data.simpan(input);
}

export async function ubahMahasiswa(id, input) {
    const lama = await detailMahasiswa(id);                    // 400 / 404 bila id keliru atau tidak ada

    const bentrok = await data.cariByNim(input.nim);
    if (bentrok && bentrok.id !== lama.id) {                   // NIM dipakai mahasiswa LAIN
        throw new AppError(409, `NIM ${input.nim} sudah dipakai mahasiswa lain`, 'NIM_DUPLIKAT');
    }

    return data.ubah(lama.id, input);
}

export async function hapusMahasiswa(id) {
    const m = await detailMahasiswa(id);
    try {
        await data.hapus(m.id);
    } catch (err) {
        if (err.code === 'P2003') {   // masih dipakai tabel pendaftaran (foreign key)
            throw new AppError(409, 'Mahasiswa masih terdaftar di kelas, batalkan pendaftarannya dulu', 'MASIH_TERDAFTAR');
        }
        throw err;
    }
}
