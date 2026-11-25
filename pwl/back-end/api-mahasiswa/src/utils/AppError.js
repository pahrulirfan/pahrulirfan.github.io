// src/utils/AppError.js
export class AppError extends Error {
    constructor(status, pesan, kode) {
        super(pesan);
        this.status = status;
        this.kode = kode;
    }
}
