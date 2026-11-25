// src/routes/auth.routes.js
import express from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { validasi } from '../middleware/validasi.js';
import { butuhLogin } from '../middleware/auth.js';
import { batasLogin } from '../middleware/batasLogin.js';
import { skemaAuth } from '../validators/auth.validator.js';

const router = express.Router();

router.post('/register', validasi(skemaAuth), ctrl.register);
router.post('/login', batasLogin, validasi(skemaAuth), ctrl.login);
router.get('/saya', butuhLogin, ctrl.saya);

export default router;
