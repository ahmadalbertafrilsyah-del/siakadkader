import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const emailKader = formData.get('emailKader');

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    // CATATAN PENTING:
    // Di sinilah nanti skrip googleapis.drive() akan dieksekusi.
    // Karena setting GDrive butuh Service Account Key (JSON) yang panjang,
    // untuk saat ini kita beri "respon pura-pura sukses" agar tidak error di layar depan.
    
    // Nanti setelah Anda mendaftar Google Cloud Console,
    // kita akan memasukkan kodingan aslinya di sini.

    console.log(`Menerima file PDF dari: ${emailKader}`);
    console.log(`Nama file: ${file.name}`);

    // Simulasi ID dari Google Drive
    const mockDriveFileId = "1A2b3c_" + Date.now();

    return NextResponse.json({ 
      success: true, 
      fileId: mockDriveFileId,
      message: "Berhasil diupload ke GDrive" 
    }, { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}