import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Bắt đầu seed dữ liệu mẫu...");
  // Mật khẩu 3 tài khoản mẫu — KHÔNG hardcode trong mã nguồn (repo công khai).
  // Đặt SEED_PASSWORD trong .env; bỏ trống thì dùng mật khẩu tạm và nhắc đổi ngay.
  const seedPassword = process.env.SEED_PASSWORD?.trim() || "ChangeMe@123";
  if (!process.env.SEED_PASSWORD?.trim()) {
    console.warn(
      `⚠  Chưa đặt SEED_PASSWORD — dùng tạm "${seedPassword}". Hãy đổi mật khẩu ngay sau khi đăng nhập lần đầu.`
    );
  }
  const password = await bcrypt.hash(seedPassword, 10);
  const seedUsers = [
    {
      email: "admin@example.com",
      name: "Quản trị viên",
      role: "ADMIN",
    },
    {
      email: "master@example.com",
      name: "Thuyền trưởng mẫu",
      role: "MASTER",
    },
    {
      email: "crew@example.com",
      name: "Thuyền viên mẫu",
      role: "CREW",
    },
  ];
  for (const seedUser of seedUsers) {
    await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {},
      create: {
        email: seedUser.email,
        password,
        name: seedUser.name,
        role: seedUser.role,
      },
    });
  }
  const vesselSuffixes = [
    "STAR",
    "OCEAN",
    "GLORY",
    "VICTORY",
    "HORIZON",
    "PIONEER",
    "EXPLORER",
    "NAVIGATOR",
    "PHOENIX",
    "DRAGON",
    "EAGLE",
    "TITAN",
    "ORION",
    "SIRIUS",
    "VEGA",
  ];
  const vessels = [];
  for (let i = 0; i < vesselSuffixes.length; i++) {
    const code = `ML-${String(i + 1).padStart(3, "0")}`;
    const name = `MERCURY ${vesselSuffixes[i]}`;
    // Xen kẽ vài tàu theo chuẩn NAVIS để minh họa chọn mẫu form.
    const formStandard = i % 3 === 2 ? "NAVIS" : "MLS";
    const vessel = await prisma.vessel.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name,
        imo: `9${String(100000 + i * 111)}`,
        flag: "Việt Nam",
        vesselType: i % 2 === 0 ? "Bulk Carrier" : "General Cargo",
        status: "ACTIVE",
        formStandard,
        hullNo: `NB${130 + i}`,
      },
    });
    vessels.push(vessel);
  }
  const crewUser = await prisma.user.findUnique({
    where: { email: "crew@example.com" },
  });
  if (crewUser && crewUser.vesselId == null && vessels.length > 0) {
    await prisma.user.update({
      where: { id: crewUser.id },
      data: { vesselId: vessels[0].id },
    });
  }
  const warehouseTemplates = [
    { suffix: "ENG", name: "Kho máy", type: "VESSEL" },
    { suffix: "DECK", name: "Kho boong", type: "VESSEL" },
    { suffix: "STORE", name: "Kho vật tư tiêu hao", type: "VESSEL" },
  ];
  for (const vessel of vessels) {
    for (const wh of warehouseTemplates) {
      const code = `${vessel.code}-${wh.suffix}`;
      await prisma.warehouse.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: `${wh.name} - ${vessel.name}`,
          warehouseType: wh.type,
          vesselId: vessel.id,
        },
      });
    }
  }
  const lashingGearTemplates = [
    { name: "SEMI-AUTO TWIST LOCK", partNo: "TL-8/S", minQty: 1741, standardQty: 1741 },
    { name: "HAND TWISTLOCK", partNo: "TL-2L", minQty: 276, standardQty: 276 },
    { name: "TURNBUCKLE", partNo: "B-31B(1080-1490)", minQty: 347, standardQty: 347 },
    { name: "LASHING BAR 2.2M", partNo: "LR-5/2450", minQty: 276, standardQty: 276 },
    { name: "LASHING BAR 4.8M", partNo: "LR-5/4950", minQty: 103, standardQty: 103 },
    { name: "TWIST STACKER", partNo: "ML-2A", minQty: 212, standardQty: 212 },
    { name: "MID LOCK CONE", partNo: "S-8HD", minQty: 580, standardQty: 580 },
    { name: "SEMI-AUTO TWIST LOCK (SPARE)", partNo: "K-2556", minQty: 0, standardQty: 0 },
    { name: "LASHING EYE (SCLASH)", partNo: "LE-1FA", minQty: 0, standardQty: 0 },
    { name: "20F FLAT CONT W/BOXES", partNo: "K-2742-A", minQty: 1, standardQty: 1 },
  ];
  for (const vessel of vessels) {
    for (let i = 0; i < lashingGearTemplates.length; i++) {
      const gear = lashingGearTemplates[i];
      await prisma.lashingGear.upsert({
        where: {
          vesselId_name: { vesselId: vessel.id, name: gear.name },
        },
        update: {},
        create: {
          vesselId: vessel.id,
          name: gear.name,
          partNo: gear.partNo,
          minQty: gear.minQty,
          standardQty: gear.standardQty,
          sortOrder: i + 1,
        },
      });
    }
  }
  const categories = [
    { code: "ENG", name: "Vật tư máy" },
    { code: "DECK", name: "Vật tư boong" },
    { code: "ELEC", name: "Vật tư điện" },
    { code: "SAF", name: "Thiết bị an toàn" },
    { code: "CON", name: "Vật tư tiêu hao" },
  ];
  for (const category of categories) {
    await prisma.category.upsert({
      where: { code: category.code },
      update: {},
      create: {
        code: category.code,
        name: category.name,
      },
    });
  }
  const materials = [
    {
      code: "ML-ENG-0001",
      nameVn: "Lõi lọc dầu bôi trơn máy chính",
      nameEn: "Main engine lube oil filter element",
      impa: "345678",
      partNumber: "LO-2345",
      manufacturer: "MAN Energy Solutions",
      uom: "PCS",
      categoryCode: "ENG",
      minStock: 12,
      maxStock: 48,
      isCritical: true,
    },
    {
      code: "ML-ENG-0002",
      nameVn: "Lõi lọc nhiên liệu",
      nameEn: "Fuel oil filter element",
      impa: "345679",
      partNumber: "FO-5678",
      manufacturer: "Wartsila",
      uom: "PCS",
      categoryCode: "ENG",
      minStock: 24,
      maxStock: 96,
      isCritical: true,
    },
    {
      code: "ML-ENG-0003",
      nameVn: "Dầu thủy lực",
      nameEn: "Hydraulic oil",
      impa: "349001",
      partNumber: "HYD-46",
      manufacturer: "Total",
      uom: "LIT",
      categoryCode: "ENG",
      minStock: 200,
      maxStock: 1000,
      isCritical: false,
    },
    {
      code: "ML-DECK-0001",
      nameVn: "Sơn chống rỉ",
      nameEn: "Anti-rust paint",
      impa: "350001",
      partNumber: "PRIMER-20L",
      manufacturer: "Jotun",
      uom: "PAIL",
      categoryCode: "DECK",
      minStock: 20,
      maxStock: 100,
      isCritical: false,
    },
    {
      code: "ML-DECK-0002",
      nameVn: "Dây mooring",
      nameEn: "Mooring rope",
      impa: "351002",
      partNumber: "PP-36MM",
      manufacturer: "Samyang",
      uom: "ROLL",
      categoryCode: "DECK",
      minStock: 4,
      maxStock: 12,
      isCritical: false,
    },
    {
      code: "ML-ELEC-0001",
      nameVn: "Đèn hành trình",
      nameEn: "Navigation light",
      impa: "360001",
      partNumber: "NAV-24V",
      manufacturer: "Sauter",
      uom: "SET",
      categoryCode: "ELEC",
      minStock: 6,
      maxStock: 24,
      isCritical: true,
    },
    {
      code: "ML-ELEC-0002",
      nameVn: "Cáp điện hàng hải",
      nameEn: "Marine cable",
      impa: "360123",
      partNumber: "CABLE-3X2.5",
      manufacturer: "LS Cable",
      uom: "M",
      categoryCode: "ELEC",
      minStock: 500,
      maxStock: 2000,
      isCritical: false,
    },
    {
      code: "ML-SAF-0001",
      nameVn: "Bình chữa cháy CO2",
      nameEn: "CO2 fire extinguisher",
      impa: "370001",
      partNumber: "CO2-5KG",
      manufacturer: "Kidde",
      uom: "PCS",
      categoryCode: "SAF",
      minStock: 10,
      maxStock: 40,
      isCritical: true,
    },
    {
      code: "ML-SAF-0002",
      nameVn: "Phao áo",
      nameEn: "Life jacket",
      impa: "370100",
      partNumber: "LJ-ADULT",
      manufacturer: "Viking",
      uom: "PCS",
      categoryCode: "SAF",
      minStock: 30,
      maxStock: 100,
      isCritical: true,
    },
    {
      code: "ML-CON-0001",
      nameVn: "Găng tay bảo hộ",
      nameEn: "Safety gloves",
      impa: "380001",
      partNumber: "GLV-L",
      manufacturer: "3M",
      uom: "PAIR",
      categoryCode: "CON",
      minStock: 100,
      maxStock: 500,
      isCritical: false,
    },
  ];
  // Phân loại phụ tùng (SPARE) gắn với thiết bị; còn lại là vật tư (STORE)
  const spareEquipment: Record<string, string> = {
    "ML-ENG-0001": "Máy chính (Main Engine)",
    "ML-ENG-0002": "Máy chính (Main Engine)",
    "ML-ELEC-0001": "Hệ thống đèn hàng hải",
  };
  for (const material of materials) {
    const category = await prisma.category.findUnique({
      where: { code: material.categoryCode },
    });
    const equipment = spareEquipment[material.code] ?? null;
    const materialType = equipment ? "SPARE" : "STORE";
    await prisma.material.upsert({
      where: { code: material.code },
      update: { materialType, equipment },
      create: {
        code: material.code,
        nameVn: material.nameVn,
        nameEn: material.nameEn,
        impa: material.impa,
        partNumber: material.partNumber,
        manufacturer: material.manufacturer,
        uom: material.uom,
        materialType,
        equipment,
        categoryId: category?.id ?? null,
        minStock: material.minStock,
        maxStock: material.maxStock,
        isCritical: material.isCritical,
      },
    });
  }
  const dbVessels = await prisma.vessel.findMany({ orderBy: { id: "asc" } });
  const dbMaterials = await prisma.material.findMany({ orderBy: { id: "asc" } });
  for (const vessel of dbVessels) {
    const warehouses = await prisma.warehouse.findMany({
      where: { vesselId: vessel.id },
    });
    if (!warehouses.length) continue;
    for (const material of dbMaterials) {
      const warehouse = material.code.includes("DECK")
        ? warehouses.find((w) => w.code.endsWith("-DECK"))
        : (warehouses.find((w) => w.code.endsWith("-ENG")) ?? warehouses[0]);
      if (!warehouse) continue;
      const shouldLowStock = (vessel.id + material.id) % 4 === 0;
      const quantity = shouldLowStock
        ? Math.max(0, material.minStock - 5)
        : material.minStock + 10 + ((vessel.id + material.id) % 15);
      await prisma.inventory.upsert({
        where: {
          materialId_warehouseId: {
            materialId: material.id,
            warehouseId: warehouse.id,
          },
        },
        update: {},
        create: {
          materialId: material.id,
          warehouseId: warehouse.id,
          vesselId: vessel.id,
          quantity,
          reservedQuantity: 0,
        },
      });
    }
  }
  // Gán mọi vật tư vào danh mục của mọi tàu (mặc định tàu nào cũng dùng).
  for (const vessel of dbVessels) {
    for (const material of dbMaterials) {
      await prisma.vesselMaterial.upsert({
        where: {
          vesselId_materialId: {
            vesselId: vessel.id,
            materialId: material.id,
          },
        },
        update: {},
        create: { vesselId: vessel.id, materialId: material.id },
      });
    }
  }
  const suppliers = [
    {
      code: "SUP-001",
      name: "Sea Supply Co., Ltd",
      contact: "Mr. Tanaka",
      email: "sales@seasupply.com",
      phone: "+65 6123 4567",
      address: "12 Marine Drive, Singapore",
    },
    {
      code: "SUP-002",
      name: "Ocean Marine Parts",
      contact: "Ms. Linh",
      email: "info@oceanmarine.vn",
      phone: "+84 28 3822 1234",
      address: "45 Nguyễn Tất Thành, Q.4, TP.HCM",
    },
    {
      code: "SUP-003",
      name: "Global Ship Chandler",
      contact: "Mr. Kumar",
      email: "order@globalchandler.com",
      phone: "+971 4 555 8888",
      address: "Port Rashid, Dubai, UAE",
    },
  ];
  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: {},
      create: supplier,
    });
  }
  const { SEED_STANDARDS } = await import("../lib/formStandards");
  for (const s of SEED_STANDARDS) {
    await prisma.formStandard.upsert({
      where: { code: s.code },
      update: {},
      create: {
        code: s.code,
        label: s.label,
        companyName: s.companyName,
        address: s.address,
        repAddress: s.repAddress ?? null,
        tel: s.tel ?? null,
        email: s.email ?? null,
        website: s.website ?? null,
      },
    });
  }
  console.log("Seed dữ liệu hoàn tất.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
