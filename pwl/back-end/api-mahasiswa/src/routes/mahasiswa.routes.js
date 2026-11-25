// src/routes/mahasiswa.routes.js
import express from 'express';
import * as ctrl from '../controllers/mahasiswa.controller.js';
import { butuhLogin, butuhRole } from '../middleware/auth.js';
import { validasi } from '../middleware/validasi.js';
import { skemaMahasiswa } from '../validators/mahasiswa.validator.js';

const router = express.Router();

router.get('/', butuhLogin, ctrl.daftar);
router.get('/:id', butuhLogin, ctrl.detail);
router.post('/', butuhLogin, butuhRole('admin', 'dosen'), validasi(skemaMahasiswa), ctrl.buat);
router.put('/:id', butuhLogin, butuhRole('admin', 'dosen'), validasi(skemaMahasiswa), ctrl.ubah);
router.delete('/:id', butuhLogin, butuhRole('admin'), ctrl.hapus);

export default router;
