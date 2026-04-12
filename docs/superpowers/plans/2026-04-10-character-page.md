# Character Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the /character page where players view stats, distribute free points, manage skill loadout via modal, upload avatar, and browse unlocked skills.

**Architecture:** Client component page with 5 extracted sub-components in `_components/` directory. Data from 3 parallel API fetches. State managed at page level, passed down as props. Modal for skill selection with client-side filtering.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, fetch API with Bearer token auth.

---

### Task 1: Page shell + data fetching

**Files:**
- Create: `app/(game)/character/page.tsx`

- [ ] **Step 1: Create the page with data fetching**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { expToNextLevel } from "@/lib/exp/formulas";
import type { Character } from "@/types/character";
import type { CharacterSkillSlot } from "@/types/skill";

type UserProfile = {
  name: string;
  avatarUrl: string | null;
  house: { name: string; animal: string; description: string } | null;
};

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

function clearAuthAndRedirect(router: ReturnType<typeof useRouter>) {
  localStorage.removeItem("access_token");
  document.cookie = "access_token=; path=/; max-age=0; samesite=strict";
  router.push("/login");
}

export default function CharacterPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [equippedSkills, setEquippedSkills] = useState<CharacterSkillSlot[]>([]);
  const [unequippedSkills, setUnequippedSkills] = useState<CharacterSkillSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) { clearAuthAndRedirect(router); return; }
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [profileRes, charRes, skillsRes] = await Promise.all([
        fetch("/api/user/profile", { headers }),
        fetch("/api/character", { headers }),
        fetch("/api/character/skills", { headers }),
      ]);

      if (profileRes.status === 401 || charRes.status === 401 || skillsRes.status === 401) {
        clearAuthAndRedirect(router); return;
      }

      if (profileRes.ok) {
        const json = (await profileRes.json()) as { data: UserProfile };
        setProfile(json.data);
      }
      if (charRes.ok) {
        const json = (await charRes.json()) as { data: { character: Character; skills: CharacterSkillSlot[] } };
        setCharacter(json.data.character);
      }
      if (skillsRes.ok) {
        const json = (await skillsRes.json()) as { data: { equipped: CharacterSkillSlot[]; unequipped: CharacterSkillSlot[] } };
        setEquippedSkills(json.data.equipped);
        setUnequippedSkills(json.data.unequipped);
      }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-xl bg-[var(--bg-card)]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="h-80 animate-pulse rounded-xl bg-[var(--bg-card)]" />
          <div className="h-80 animate-pulse rounded-xl bg-[var(--bg-card)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-400">Character page — components coming next</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify page loads**

Run: `npm run dev`, navigate to `/character`. Should show "Character page — components coming next" without errors.

---

### Task 2: CharacterHeader component

**Files:**
- Create: `app/(game)/character/_components/CharacterHeader.tsx`
- Modify: `app/(game)/character/page.tsx` — import and render

- [ ] **Step 1: Create CharacterHeader**

```tsx
"use client";

import { useRef, useState } from "react";
import { expToNextLevel } from "@/lib/exp/formulas";
import type { Character } from "@/types/character";

const HOUSE_EMOJI: Record<string, string> = {
  ARION: "\u{1F981}",
  LYCUS: "\u{1F43A}",
  NOCTIS: "\u{1F989}",
  NEREID: "\u{1F9DC}",
};

type Props = {
  profile: {
    name: string;
    avatarUrl: string | null;
    house: { name: string; animal: string } | null;
  };
  character: Character;
  onAvatarChange: (newUrl: string) => void;
};

export default function CharacterHeader({ profile, character, onAvatarChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const json = (await res.json()) as { data: { avatarUrl: string } };
        onAvatarChange(json.data.avatarUrl);
      }
    } catch { /* silencioso */ }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const needed = expToNextLevel(character.level);
  const pct = needed === 0 ? 100 : Math.min(100, Math.round((character.currentExp / needed) * 100));

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-5">
        {/* Avatar */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[var(--border-subtle)] transition-colors hover:border-[var(--accent-primary)] disabled:opacity-50"
        >
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--accent-primary)]/20 text-xl font-bold text-[var(--accent-primary)]">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">{profile.name}</h1>
            {profile.house && (
              <span className="rounded-md bg-[var(--accent-primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)]">
                {HOUSE_EMOJI[profile.house.name] ?? ""} {profile.house.animal}
              </span>
            )}
          </div>

          {/* Level + EXP */}
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-bold text-white">
              {character.level}
            </span>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {character.currentExp} / {needed} EXP
              </p>
            </div>
            {character.freePoints > 0 && (
              <span className="rounded-lg bg-[var(--accent-primary)]/20 px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)]">
                {character.freePoints} pontos livres
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into page**

In `page.tsx`, import and render `CharacterHeader` inside the return block, replacing the placeholder text. Pass `profile`, `character`, and an `onAvatarChange` callback that updates `profile.avatarUrl` in state.

- [ ] **Step 3: Verify**

Navigate to `/character`. Should show avatar circle (clickable), name, house badge, level, EXP bar, free points badge.

---

### Task 3: AttributePanel component with point distribution

**Files:**
- Create: `app/(game)/character/_components/AttributePanel.tsx`
- Modify: `app/(game)/character/page.tsx` — import and render

- [ ] **Step 1: Create AttributePanel**

Component with two modes:
- **View mode** (freePoints === 0): just show the 6 stats with icon, name, value.
- **Distribute mode** (freePoints > 0): show +/- buttons, preview values, confirm/reset buttons.

Key logic:
- Local state `allocation: Record<string, number>` starts all zeros
- `remaining = character.freePoints - totalAllocated`
- "+" disabled when remaining === 0
- "-" disabled when allocation for that stat === 0
- HP preview shows `value + allocation * 10`, others show `value + allocation`
- "Confirmar" calls `POST /api/character/distribute-points` with `{ distribution: allocation }`, then calls `onDistribute(updatedCharacter)` prop
- "Resetar" clears allocation to all zeros

Stats to show (in order): physicalAtk, physicalDef, magicAtk, magicDef, hp, speed. Each with icon and label matching the dashboard.

Note on HP: the API handles the x10 multiplier server-side. The `distribution` sends raw point count (e.g., `{ hp: 2 }`), and the API applies `+20` to HP. The preview should show `currentHP + allocation * 10` to match what the server will do.

- [ ] **Step 2: Wire into page**

Add to the left column of the grid layout. Pass `character` and `onDistribute` callback that updates `setCharacter`.

- [ ] **Step 3: Verify**

If the character has freePoints > 0, the +/- buttons should appear. Allocate points, see preview, confirm, verify stats update.

---

### Task 4: SkillLoadout component

**Files:**
- Create: `app/(game)/character/_components/SkillLoadout.tsx`
- Modify: `app/(game)/character/page.tsx` — import and render

- [ ] **Step 1: Create SkillLoadout**

Grid 2x2 of 4 slots (index 0-3).

Props:
```tsx
type Props = {
  equipped: CharacterSkillSlot[];
  onSlotClick: (slotIndex: number) => void;
  onUnequip: (slotIndex: number) => void;
};
```

Each slot:
- Find skill by `equipped.find(s => s.slotIndex === idx)`
- **Occupied**: show skill name (truncate), tier badge (T1=gray, T2=blue, T3=purple), cooldown if > 0, damage type. Button X in corner calls `onUnequip(idx)`.
- **Empty**: dashed border, "Escolher skill" text, click calls `onSlotClick(idx)`.
- Click on occupied slot also calls `onSlotClick(idx)`.

Tier badge colors:
```tsx
const TIER_COLORS: Record<number, string> = {
  1: "text-gray-400 bg-gray-500/15",
  2: "text-blue-400 bg-blue-500/15",
  3: "text-purple-400 bg-purple-500/15",
};
```

Damage type labels:
```tsx
const DAMAGE_TYPE_LABEL: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};
```

- [ ] **Step 2: Wire into page with unequip handler**

In page.tsx, add state `const [selectedSlot, setSelectedSlot] = useState<number | null>(null)`.

The `onUnequip` handler: call `PUT /api/character/skills/unequip` with `{ slotIndex }`, then re-fetch skills (or optimistically update state by moving the skill from equipped to unequipped).

- [ ] **Step 3: Verify**

Should show 4 slots. Equipped skills show name/tier/cooldown. Empty slots show dashed border. X button unequips.

---

### Task 5: SkillSelectModal component

**Files:**
- Create: `app/(game)/character/_components/SkillSelectModal.tsx`
- Modify: `app/(game)/character/page.tsx` — import and render

- [ ] **Step 1: Create SkillSelectModal**

Props:
```tsx
type Props = {
  open: boolean;
  slotIndex: number;
  allSkills: CharacterSkillSlot[];  // equipped + unequipped combined
  onSelect: (skillId: string, slotIndex: number) => void;
  onClose: () => void;
};
```

Structure:
- Overlay: fixed inset-0, bg-black/60, z-50, click outside closes
- Card: centered, max-w-lg, max-h-[80vh], overflow-y-auto
- Header: "Escolher habilidade — Slot {slotIndex + 1}" + close X button
- Filters: horizontal toggles for Tier (T1/T2/T3) and Damage Type (Fisico/Magico/Suporte). All active by default. Multi-select toggles.
- Filter state: `activeTiers: Set<number>`, `activeDamageTypes: Set<string>`
- Filtered list: `allSkills.filter(s => activeTiers.has(s.skill.tier) && activeDamageTypes.has(s.skill.damageType))`
- Each skill card: name, tier badge, cooldown, damage type, description (1 line truncated). If equipped in another slot, show "Slot X" badge.
- Click on skill card: calls `onSelect(skill.id, slotIndex)`, which calls the equip API and closes modal.
- Empty state: "Nenhuma habilidade encontrada" if filters exclude everything.

- [ ] **Step 2: Wire into page with equip handler**

In page.tsx:
- `selectedSlot` state controls modal open/close
- `onSlotClick` sets `selectedSlot`
- `onSelect` handler: call `PUT /api/character/skills/equip` with `{ skillId, slotIndex }`, then re-fetch skills from `GET /api/character/skills` and update both equipped/unequipped state. Close modal.
- `onClose` sets `selectedSlot` to null

Combine equipped + unequipped into a single `allSkills` array for the modal.

- [ ] **Step 3: Verify**

Click a slot, modal opens with all skills. Filter by tier, filter by damage type. Click a skill to equip. Modal closes, slot updates.

---

### Task 6: SkillInventory component

**Files:**
- Create: `app/(game)/character/_components/SkillInventory.tsx`
- Modify: `app/(game)/character/page.tsx` — import and render

- [ ] **Step 1: Create SkillInventory**

Props:
```tsx
type Props = {
  skills: CharacterSkillSlot[];  // all skills (equipped + unequipped)
};
```

- Title: "Habilidades desbloqueadas (X/49)"
- Responsive grid: 1 col mobile, 2 cols sm, 3 cols lg
- Each card shows:
  - Name + tier badge
  - Cooldown, damage type, target
  - Full description text
  - Effects summary: iterate `skill.effects` and render human-readable text per effect type. Key effect types to summarize:
    - BUFF: "+{value} {stat} ({duration}t)"
    - DEBUFF: "-{value} {stat} ({duration}t)"
    - STATUS: "{status} {chance}% ({duration}t)"
    - HEAL: "Cura {percent}%"
    - RECOIL: "Recoil {percentOfDamage}%"
    - Others: just show the type name
  - If equipped: badge showing which slot (0-3)
- If no skills: "Nenhuma habilidade desbloqueada. Complete tarefas diarias para desbloquear."

- [ ] **Step 2: Wire into page**

Render below the grid (full width) or below the loadout in the right column. Pass combined equipped + unequipped skills.

- [ ] **Step 3: Verify**

Should show all unlocked skills with full details. Equipped skills show slot badge.

---

### Task 7: Final page assembly + layout

**Files:**
- Modify: `app/(game)/character/page.tsx` — final layout

- [ ] **Step 1: Assemble final layout**

```tsx
return (
  <div className="space-y-6">
    <CharacterHeader
      profile={profile}
      character={character}
      onAvatarChange={handleAvatarChange}
    />

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* Left column */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <AttributePanel
          character={character}
          onDistribute={handleDistribute}
        />
      </div>

      {/* Right column */}
      <div className="space-y-6">
        <SkillLoadout
          equipped={equippedSkills}
          onSlotClick={handleSlotClick}
          onUnequip={handleUnequip}
        />
        <SkillInventory skills={allSkills} />
      </div>
    </div>

    {selectedSlot !== null && (
      <SkillSelectModal
        open={selectedSlot !== null}
        slotIndex={selectedSlot}
        allSkills={allSkills}
        onSelect={handleEquip}
        onClose={() => setSelectedSlot(null)}
      />
    )}
  </div>
);
```

- [ ] **Step 2: Implement all handler functions**

```tsx
function handleAvatarChange(newUrl: string) {
  setProfile(prev => prev ? { ...prev, avatarUrl: newUrl } : prev);
}

function handleDistribute(updatedCharacter: Character) {
  setCharacter(updatedCharacter);
}

function handleSlotClick(slotIndex: number) {
  setSelectedSlot(slotIndex);
}

async function handleUnequip(slotIndex: number) {
  const token = getToken();
  if (!token) return;
  const res = await fetch("/api/character/skills/unequip", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ slotIndex }),
  });
  if (res.ok) await refetchSkills();
}

async function handleEquip(skillId: string, slotIndex: number) {
  const token = getToken();
  if (!token) return;
  const res = await fetch("/api/character/skills/equip", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ skillId, slotIndex }),
  });
  if (res.ok) {
    await refetchSkills();
    setSelectedSlot(null);
  }
}

async function refetchSkills() {
  const token = getToken();
  if (!token) return;
  const res = await fetch("/api/character/skills", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const json = (await res.json()) as { data: { equipped: CharacterSkillSlot[]; unequipped: CharacterSkillSlot[] } };
    setEquippedSkills(json.data.equipped);
    setUnequippedSkills(json.data.unequipped);
  }
}

const allSkills = [...equippedSkills, ...unequippedSkills];
```

- [ ] **Step 3: Full end-to-end test**

1. Navigate to `/character`
2. Verify header shows name, house, level, EXP bar
3. Click avatar to upload (if Cloudinary configured)
4. If freePoints > 0: allocate points with +/-, confirm, verify stats update
5. Click a slot → modal opens with skills list
6. Filter by tier → list updates
7. Click a skill → equips in slot, modal closes
8. Click X on equipped slot → skill moves to unequipped
9. Scroll down → inventory shows all skills with details
10. Test on mobile viewport → layout stacks vertically
