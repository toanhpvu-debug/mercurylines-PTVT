import { readFileSync } from "fs";
import { parseMaterialExcel } from "@/lib/materialImport";
import { prisma } from "@/lib/prisma";

// Nguồn sự thật: file kiểm kê gốc của từng tàu, khai trong scripts/nguon-kiem-ke.json.
const CONFIG = JSON.parse(
  readFileSync(new URL("./nguon-kiem-ke.json", import.meta.url), "utf8")
) as { tau: Record<string, string[]> };
const SOURCES = CONFIG.tau;

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const cleanId = (s: string | null) => {
  if (!s) return null;
  const t = s.trim();
  if (!t || !/[A-Za-z0-9]/.test(t)) return null;
  if (/^(n\/?a|tba|tbd|nil|none|x+|-+)$/i.test(t)) return null;
  return t;
};

async function main() {
  const materials = await prisma.material.findMany();
  const byImpa = new Map(materials.filter(m => m.impa).map(m => [norm(m.impa!), m]));
  const byPn = new Map(materials.filter(m => m.partNumber).map(m => [norm(m.partNumber!), m]));
  const byName = new Map(materials.map(m => [`${norm(m.nameVn)}|${m.equipment ? norm(m.equipment) : ""}`, m]));

  const vessels = await prisma.vessel.findMany({ orderBy: { code: "asc" } });

  for (const vessel of vessels) {
    const files = SOURCES[vessel.code] ?? [];
    // Tap hop vat tu ma FILE NGUON quy dinh cho tau nay
    const expected = new Set<number>();
    let parsedRows = 0, unresolved = 0;
    for (const f of files) {
      const r = parseMaterialExcel(readFileSync(f));
      if (r.error) { console.log(`  ! ${f}: ${r.error}`); continue; }
      parsedRows += r.items.length;
      for (const it of r.items) {
        const m =
          (it.impa && byImpa.get(norm(cleanId(it.impa) ?? ""))) ||
          (it.partNumber && byPn.get(norm(cleanId(it.partNumber) ?? ""))) ||
          byName.get(`${norm(it.name)}|${it.equipment ? norm(it.equipment) : ""}`) ||
          null;
        if (m) expected.add(m.id); else unresolved++;
      }
    }

    const assigned = await prisma.vesselMaterial.findMany({
      where: { vesselId: vessel.id },
      include: { material: { select: { id: true, code: true, nameVn: true, materialType: true } } },
    });
    const assignedIds = new Set(assigned.map(a => a.materialId));

    const thua = assigned.filter(a => !expected.has(a.materialId));
    const thieu = [...expected].filter(id => !assignedIds.has(id));

    console.log(`\n=== ${vessel.code}  ${vessel.name} ===`);
    console.log(`  File nguon        : ${files.length ? files.map(f => f.split("/").pop()).join(", ") : "KHONG CO FILE"}`);
    console.log(`  Dong doc tu file  : ${parsedRows}${unresolved ? ` (${unresolved} dong khong khop vat tu nao)` : ""}`);
    console.log(`  File quy dinh     : ${expected.size} vat tu`);
    console.log(`  Dang gan trong app: ${assigned.length} vat tu`);
    console.log(`  -> THUA (can go)  : ${thua.length}`);
    console.log(`  -> THIEU (can them): ${thieu.length}`);
    if (thua.length && thua.length <= 15) {
      for (const a of thua) console.log(`       ${a.material.code}  ${a.material.nameVn}`);
    } else if (thua.length) {
      for (const a of thua.slice(0, 10)) console.log(`       ${a.material.code}  ${a.material.nameVn}`);
      console.log(`       ... va ${thua.length - 10} dong nua`);
    }
  }
  await prisma.$disconnect();
}
main();
