// src/controllers/pendaftaran.controller.js
import * as service from '../services/pendaftaran.service.js';

export async function daftar(req, res) {
    const hasil = await service.daftarPendaftaran();
    res.json({ data: hasil });
}

export async function buat(req, res) {
    const { mahasiswaId, kelasId } = req.body;
    const hasil = await service.daftarKelas(mahasiswaId, kelasId);
    res.status(201).json({ data: hasil });
}
