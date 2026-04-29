// scripts/upload-story-images.ts
// Upload house intro story images to Cloudinary.
// Run with: npx tsx scripts/upload-story-images.ts

import "dotenv/config";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const HOUSES = ["Arion", "Lycus", "Noctis", "Nereid"] as const;
const SLIDES = [1, 2, 3, 4, 5] as const;

async function main() {
  const baseDir = path.resolve(__dirname, "../.claude-design/historias");

  for (const house of HOUSES) {
    for (const slide of SLIDES) {
      const filePath = path.join(baseDir, house, `Cena ${slide}.png`);
      const publicId = `craft-mind/stories/${house.toLowerCase()}/slide-${slide}`;

      console.log(`Uploading ${house}/Cena ${slide}.png -> ${publicId}...`);

      try {
        const result = await cloudinary.uploader.upload(filePath, {
          public_id: publicId,
          overwrite: true,
          resource_type: "image",
        });
        console.log(`  -> ${result.secure_url}`);
      } catch (err) {
        console.error(`  ERRO ao subir ${house}/Cena ${slide}:`, err);
      }
    }
  }

  console.log("\nUpload completo!");
}

main().catch(console.error);
