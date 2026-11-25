// src/routes/pendaftaran.routes.js
import express from 'express';
import * as ctrl from '../controllers/pendaftaran.controller.js';
import { butuhLogin } from '../middleware/auth.js';
import { validasi } from '../middleware/validasi.js';
import { skemaPendaftaran } from '../validators/pendaftaran.validator.js';

const router = express.Router();

router.get('/', butuhLogin, ctrl.daftar);
router.post('/', butuhLogin, validasi(skemaPendaftaran), ctrl.buat);

export default router;
