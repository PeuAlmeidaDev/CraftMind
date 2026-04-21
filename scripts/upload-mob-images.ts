// scripts/upload-mob-images.ts
// Upload mob images from public/monsters/ to Cloudinary and update the DB.
// Run with: npx tsx scripts/upload-mob-images.ts

import "dotenv/config";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

const MOB_IMAGE_MAP: Record<string, string> = {
  "Slime Verdejante": "slime.jpg",
  "Rato de Esgoto": "rato-esgoto.jpg",
  "Morcego Sombrio": "morcego.jpg",
  "Golem de Pedra": "golem-de-pedra.jpg",
  "Lobo Fantasma": "lobo-fantasma.jpg",
  "Feiticeira das Sombras": "feiticeira-das-sombras.jpg",
  "Cavaleiro Maldito": "cavaleiro-maldito.jpg",
  "Serpente Venenosa": "serpente-venenosa.jpg",
  "Elemental de Fogo": "elemental-fogo.jpg",
  "Dragao Jovem": "dragao-filhote.jpg",
  "Lich Anciaa": "lich-ancia.jpg",
  "Arauto do Abismo": "arauto-abismo.jpg",
};

async function main() {
  const monstersDir = path.resolve(__dirname, "../public/monsters");

  for (const [mobName, filename] of Object.entries(MOB_IMAGE_MAP)) {
    const filePath = path.join(monstersDir, filename);
    const slug = filename.replace(/\.[^.]+$/, ""); // remove extension

    console.log(`Uploading ${filename} as craft-mind/monsters/${slug}...`);

    const result = await cloudinary.uploader.upload(filePath, {
      folder: "craft-mind/monsters",
      public_id: slug,
      overwrite: true,
    });

    const secureUrl = result.secure_url;
    console.log(`  -> ${secureUrl}`);

    await prisma.mob.update({
      where: { name: mobName },
      data: { imageUrl: secureUrl },
    });

    console.log(`  -> DB updated for "${mobName}"`);
  }

  console.log("\nDone! All mob images uploaded and DB updated.");
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
