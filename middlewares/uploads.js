
import multer from "multer";
import fs from "fs";
import path from "path";

export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const filename = `${Date.now()}-${path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "_")}${extension}`;

    cb(null, filename);
  },
});

export const uploads = multer({ storage });
