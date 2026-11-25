// prisma/seed.js
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';

const NAMA = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gilang', 'Hana'];

// Akun contoh untuk mencoba login dari front end (hanya untuk pengembangan!)
const AKUN = [
    { email: 'admin@unram.ac.id',     password: 'admin12345',     role: 'admin' },
    { email: 'dosen@unram.ac.id',     password: 'dosen12345',     role: 'dosen' },
    { email: 'mahasiswa@unram.ac.id', password: 'mahasiswa12345', role: 'mahasiswa' },
];

async function main() {
    // Kosongkan dulu (tabel anak sebelum tabel induk) supaya seed aman dijalankan ULANG
    await prisma.pendaftaran.deleteMany();
    await prisma.mahasiswa.deleteMany();
    await prisma.kelas.deleteMany();
    await prisma.user.deleteMany();

    await prisma.mahasiswa.createMany({
        data: [
            { id: 1, nim: 'F1D021001', nama: 'Andi', ipk: 3.75, semester: 6 },
            { id: 2, nim: 'F1D021002', nama: 'Budi', ipk: 3.2, semester: 6 },
            { id: 3, nim: 'F1D021003', nama: 'Citra', ipk: 3.9, semester: 4 },
            // id 4-25: dibuat dengan perulangan
            ...Array.from({ length: 22 }, (_, k) => {
                const i = k + 4;
                return {
                    id: i,
                    nim: `F1D0210${String(i).padStart(2, '0')}`,
                    nama: `${NAMA[i % 8]} ${i}`,
                    ipk: Math.round((2 + (i % 20) / 10) * 100) / 100,
                    semester: 1 + (i % 8),
                };
            }),
        ],
    });

    await prisma.kelas.createMany({
        data: [
            { id: 1, nama: 'Pemrograman Web Lanjut', kuota: 28 },
            { id: 2, nama: 'Basis Data', kuota: 1 },
        ],
    });

    await prisma.pendaftaran.createMany({
        data: [
            { id: 1, mahasiswaId: 1, kelasId: 1 },
            { id: 2, mahasiswaId: 2, kelasId: 1 },
        ],
    });

    await prisma.user.createMany({
        data: await Promise.all(
            AKUN.map(async ({ email, password, role }) => ({
                email,
                role,
                passwordHash: await bcrypt.hash(password, 10),
            })),
        ),
    });

    console.log('Seed selesai: 25 mahasiswa, 2 kelas, 2 pendaftaran, 3 akun');
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
