-- ============================================================================
-- Migration: allow_card_duplicates
--
-- 1. Converte cada PendingCardDuplicate existente em uma UserCard NOVA com
--    xp=0, level=1, equipped=false, slotIndex=NULL e purity=newPurity da
--    pendencia. ID gerado via md5(random() || clock_timestamp()) — formato
--    compativel com a coluna TEXT (Prisma cuid tambem e TEXT). Nao requer
--    extensao adicional.
-- 2. Dropa a tabela PendingCardDuplicate (e a unique constraint
--    [userId, cardId] do UserCard).
-- 3. Adiciona indice composto [userId, cardId] no UserCard para acelerar a
--    query "minhas copias deste cardId".
-- ============================================================================

-- 1. Converter pendings existentes em UserCards novas ANTES de dropar a tabela.
INSERT INTO "UserCard" (id, "userId", "cardId", equipped, "slotIndex", xp, level, purity, "spectralSkillId", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || pcd.id),
    pcd."userId",
    uc."cardId",
    false,
    NULL,
    0,
    1,
    pcd."newPurity",
    NULL,
    NOW(),
    NOW()
FROM "PendingCardDuplicate" pcd
INNER JOIN "UserCard" uc ON uc.id = pcd."userCardId";

-- 2. Drop foreign keys, indices e a tabela PendingCardDuplicate.
ALTER TABLE "PendingCardDuplicate" DROP CONSTRAINT IF EXISTS "PendingCardDuplicate_userCardId_fkey";
ALTER TABLE "PendingCardDuplicate" DROP CONSTRAINT IF EXISTS "PendingCardDuplicate_userId_fkey";
DROP INDEX IF EXISTS "PendingCardDuplicate_userCardId_idx";
DROP INDEX IF EXISTS "PendingCardDuplicate_userId_createdAt_idx";
DROP TABLE IF EXISTS "PendingCardDuplicate";

-- 3. Drop a unique constraint que limitava a 1 carta por user por cardId.
ALTER TABLE "UserCard" DROP CONSTRAINT IF EXISTS "UserCard_userId_cardId_key";
DROP INDEX IF EXISTS "UserCard_userId_cardId_key";

-- 4. Cria indice composto para "minhas copias deste cardId".
CREATE INDEX "UserCard_userId_cardId_idx" ON "UserCard"("userId", "cardId");
