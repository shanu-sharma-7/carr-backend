
import multer from "multer";
import fs from "fs";
import path from "path";

export const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads")
);

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const originalName = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    cb(null, `${Date.now()}-${originalName}${extension}`);
  },
});

export const uploads = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
