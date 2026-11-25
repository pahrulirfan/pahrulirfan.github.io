// index.js
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from './src/middleware/logger.js';
import { notFound } from './src/middleware/notFound.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import authRoutes from './src/routes/auth.routes.js';
import mahasiswaRoutes from './src/routes/mahasiswa.routes.js';
import pendaftaranRoutes from './src/routes/pendaftaran.routes.js';

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET belum diisi. Salin .env.example menjadi .env, lalu isi nilainya.');
    process.exit(1);
}

const app = express();

// Middleware yang berlaku untuk semua rute dipasang paling awal.
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));   // sebelum rute dan auth
app.use(express.json());
app.use(logger);

app.get('/', (req, res) => {
    res.send('Halo dari Express!');
});

app.use('/auth', authRoutes);
app.use('/mahasiswa', mahasiswaRoutes);
app.use('/pendaftaran', pendaftaranRoutes);

app.use(notFound);        // tidak ada rute yang cocok
app.use(errorHandler);    // SELALU paling terakhir

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, (err) => {
    if (err) {
        console.error('Gagal menjalankan server:', err.message);
        process.exit(1);
    }
    console.log(`Server jalan di http://localhost:${PORT}`);
});
