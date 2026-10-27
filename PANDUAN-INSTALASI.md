# Panduan Instalasi — Poli Exclusive Sakinah

Aplikasi terdiri dari **dua bagian**:

| Bagian | Isi | Dipasang di |
|---|---|---|
| **Backend** (server data) | 6 berkas `.gs` + `appsscript.json` | Google Apps Script (akun Google Anda) |
| **Frontend** (tampilan) | folder `poli-exclusive-sakinah` (ZIP) | GitHub Pages (atau Netlify/Vercel) |

Urutan pemasangan: **Backend → salin URL → isi di Frontend → Deploy Frontend**.

---

## BAGIAN A — Pasang Backend (± 10 menit)

1. Buka <https://script.google.com> → **New project** → beri nama `Poli Exclusive Sakinah API`.
2. Hapus isi `Code.gs` bawaan. Buat berkas-berkas berikut (tombol **+** di samping *Files* → *Script*) dan **tempel isi** dari berkas yang Anda unduh. Nama harus sama:
   `Kode` · `Pendaftaran` · `Admin` · `Notifikasi` · `Dokumen` · `QrLib`
3. Klik ikon ⚙️ **Project Settings** → centang **Show "appsscript.json" manifest file in editor**. Kembali ke *Editor*, buka `appsscript.json`, ganti seluruh isinya dengan isi berkas `appsscript.json`.
4. Pilih fungsi **`setupAplikasi`** di menu atas → klik **Run**. Klik **Review permissions → pilih akun → Advanced → Go to … (unsafe) → Allow** (wajar untuk script milik sendiri).
5. Buka **Execution log**. Catat:
   - *LOGIN ADMIN → username `admin`, kata sandi `xxxxxxxxxx`* (kata sandi sementara)
   - Tautan spreadsheet database dan folder Drive yang dibuat otomatis.
6. (Opsional, untuk mencoba) jalankan **`isiDataContoh`** → membuat 3 dokter contoh. Ganti dengan dokter sebenarnya nanti.
7. **Deploy** → **New deployment** → ikon ⚙️ pilih **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Klik **Deploy**, lalu **salin Web app URL** (berakhiran `/exec`).

> **Setelah mengubah kode backend di masa depan:** Deploy → **Manage deployments** → ✏️ Edit → *Version: New version* → Deploy. (URL tetap sama.)

## BAGIAN B — Isi URL di Frontend

1. Ekstrak `poli-exclusive-sakinah.zip`.
2. Buka `poli-exclusive-sakinah/js/config.js` dengan Notepad. Ganti `GANTI_DENGAN_URL_WEB_APP_GAS/exec` dengan URL dari langkah A-7:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
3. Simpan.

## BAGIAN C — Deploy Frontend ke GitHub Pages

> Folder kerja Anda adalah **folder `poli-exclusive-sakinah` hasil ekstrak** — folder yang langsung berisi `index.html`, `css`, dan `js`. **Di folder inilah `git init` dijalankan**, bukan di folder di atasnya.

1. Buat akun di <https://github.com>, lalu **New repository** → nama bebas (mis. `poli-sakinah`) → **Public** → *jangan* centang README → Create.
2. Buka folder tadi. Di Windows: klik address bar File Explorer, ketik `powershell`, Enter.
3. Pastikan `dir` menampilkan **`index.html`** (jika tidak, Anda di folder yang salah).
4. Jalankan satu per satu:
   ```
   git init
   git add .
   git commit -m "Upload pertama"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
   Saat diminta *Password*, tempel **Personal Access Token** (github.com/settings/tokens → *Generate new token (classic)* → centang **repo**). Layar tidak menampilkan apa pun saat paste — itu normal.
5. Di repo: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**. Tunggu 1–2 menit; alamatnya: `https://USERNAME.github.io/NAMA-REPO/`.

Update di kemudian hari: `git add .` → `git commit -m "update"` → `git push`, lalu Ctrl+Shift+R di browser.

## BAGIAN D — Pengaturan Awal (sekali saja)

1. Buka alamat situs → login **admin** + sandi sementara → aplikasi meminta Anda **mengganti sandi**.
2. **Pengaturan → Umum**: isi nama, alamat, telepon, dan **URL aplikasi** = alamat GitHub Pages Anda (dipakai pada QR di bukti booking & pesan WhatsApp). Simpan.
3. **Dokter**: tambahkan dokter (nama, spesialis, ruang). Tidak ada jadwal atau kuota: jam kunjungan ditentukan bebas oleh pasien saat pendaftaran.
4. **Pengaturan → Pengguna**: buat akun untuk petugas pendaftaran.
5. **Pengaturan → Impor Data Lama**: bawa data spreadsheet bulanan lama (tempel tautan Google Sheets atau salin-tempel dari Excel). Gunakan **Lihat dulu** sebelum **Impor**; aman diulang.
6. **Notifikasi WhatsApp & Email** (opsional): menu *Notifikasi WhatsApp* → isi token Fonnte → aktifkan → **Kirim tes**. Atur event mana yang mengirim di tab *Event & Pesan*.

## UPDATE — Dari versi sesi/kuota ke versi Jam Bebas

Jika Anda sudah memasang versi sebelumnya:

1. **Backend**: buka Apps Script, ganti isi `Kode.gs`, `Pendaftaran.gs`, `Admin.gs`, `Notifikasi.gs`, dan `Dokumen.gs` dengan file terbaru (`QrLib.gs` dan `appsscript.json` tidak berubah). Simpan.
2. Pilih fungsi **`migrasiSkema`** lalu **Run** satu kali. Ini menambahkan kolom **Jam** di akhir sheet Pendaftaran. Data lama aman dan tidak diubah.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** URL tidak berubah.
4. **Frontend**: salin isi folder ZIP ke folder repository Anda, **kecuali `js/config.js`** (yang sudah berisi GAS_URL Anda). Lalu `git add .`, `git commit -m "jam bebas"`, `git push`.
5. Tekan Ctrl+F5 di browser.

Catatan: pendaftaran lama tanpa jam tetap tampil (diurutkan sebagai Pagi 08:00 / Sore 16:00). Template pesan WhatsApp yang sudah Anda ubah sendiri tidak ditimpa; jika masih memuat `{sesi}`, ganti dengan `{jam}` di menu Notifikasi.

## Cara pakai singkat

- **Pendaftaran Baru**: pilih Appointment/Onsite → tanggal → jam kunjungan (bebas, format 24 jam) & dokter → pasien terdaftar *atau* pasien baru (otomatis kartu **SASA**) → penjamin → **F4** simpan. Onsite langsung *Hadir* + nomor antrean.
- **Konfirmasi Booking**: konfirmasi satu per satu atau massal; pasien menerima pesan otomatis bila notifikasi aktif.
- **Check-in & Antrean**: tombol *Check-in* memberi nomor antrean (A-001, B-001, … per dokter).
- **Data Pasien**: filter per bulan/dokter/penjamin → **Excel** atau **PDF**.
- **Laporan & Grafik**: pasien per bulan (Sasa vs Lama), per dokter, per penjamin → **Excel/PDF**.
- **Bukti booking PDF** berisi QR; scan membuka halaman keaslian (`#/v/KODE`) tanpa login.

## Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| "URL backend belum diatur" | `js/config.js` belum diisi; isi lalu push ulang |
| Login selalu gagal | Pakai sandi dari Execution log; atau jalankan `resetSandiAdmin` di editor Apps Script |
| Setelah ubah kode, perilaku lama | Belum **New version** pada Manage deployments |
| Bukti PDF gagal | Pastikan izin Docs/Drive disetujui (atau jalankan fungsi `izinkanDokumen` dari editor Apps Script untuk memicu izin) |
| WhatsApp tidak terkirim | Cek token & status perangkat di *Notifikasi WhatsApp → Cek perangkat*, lihat tab *Antrean Kirim* |
| Notifikasi/antrean tidak jalan otomatis | Jalankan `pasangTrigger` sekali; cek *Pengaturan → Sistem* |
| Halaman tanpa gaya / 404 | Folder yang di-push salah; ulangi Bagian C dari folder yang berisi `index.html` |

## Catatan keamanan

- Token Fonnte hanya disimpan di server (Script Properties), tidak pernah dikirim ke browser.
- Sandi disimpan ter-hash bertambah garam; 5× salah → terkunci 15 menit.
- Frontend publik tidak berisi rahasia, hanya URL backend.
- Backup: salin spreadsheet database secara berkala (tautan di *Pengaturan → Sistem*).
