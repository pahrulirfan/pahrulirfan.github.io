// src/controllers/mahasiswa.controller.js
import * as service from '../services/mahasiswa.service.js';

export async function daftar(req, res) {
    res.json(await service.daftarMahasiswa(req.query));
}

export async function detail(req, res) {
    const m = await service.detailMahasiswa(req.params.id);
    res.json({ data: m });
}

export async function buat(req, res) {
    const baru = await service.buatMahasiswa(req.body);
    res.status(201).json({ data: baru });
}

export async function ubah(req, res) {
    const m = await service.ubahMahasiswa(req.params.id, req.body);
    res.json({ data: m });
}

export async function hapus(req, res) {
    await service.hapusMahasiswa(req.params.id);
    res.status(204).end();                    // 204 No Content: berhasil, tidak ada isi
}
