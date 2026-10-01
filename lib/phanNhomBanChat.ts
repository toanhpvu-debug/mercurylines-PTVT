/**
 * PHÂN NHÓM THEO BẢN CHẤT — mặt hàng thuộc nhóm nào là do NÓ LÀ GÌ, không phải
 * do nó nằm ở sheet nào của file nhập.
 *
 * Danh mục nhập từ file kiểm kê lấy bộ phận theo tên sheet ("Boong (Deck)",
 * "Vật tư bảo hộ & an toàn"...), nên cầu thang hoa tiêu nằm trong An toàn, bình
 * oxy hàn nằm trong Boong, găng tay rải ở Máy lẫn Boong. Bộ này đọc TÊN hàng
 * (Việt / Anh) trước, rồi CHƯƠNG IMPA, để xếp vào:
 *   - nhóm hiển thị: Boong · Máy · Điện · Sinh hoạt & Phục vụ · An toàn chung;
 *   - nhóm con của bộ phân loại công ty (NHOM_THIET_BI, lib/maVatTu.ts) khi rõ
 *     — từ đó ra người giữ (phao / bình chữa cháy → Phó ba, hàn cắt → Máy trưởng).
 *
 * Hàng DÙNG CHUNG nhiều bộ phận (dụng cụ cầm tay, bu lông, mỡ, băng keo, thước...)
 * không có luật — trả null để giữ chỗ cũ, không đoán. Phụ tùng (SPARE) đi theo
 * thiết bị như trước, không qua đây. Kiểm ở scripts/kiem-tra-phan-nhom-ban-chat.ts.
 */
import { chuongImpa } from "@/lib/nhomImpa";
import { departmentOfMaterial } from "@/lib/departments";

export type NhomHienThi = "DECK" | "ENGINE" | "ELEC" | "SERVICE" | "SAFETY";
export const NHOM_HIEN_THI: readonly NhomHienThi[] = ["DECK", "ENGINE", "ELEC", "SERVICE", "SAFETY"];

export type BanChat = {
  nhom: NhomHienThi;
  /** Mã nhóm con trong NHOM_THIET_BI (LSA, FFA, TOL...), null khi chỉ rõ bộ phận. */
  nhomCongTy: string | null;
  /** Vì sao — hiện cho người xem soát lại. */
  lyDo: string;
};

/** Bỏ dấu, chữ thường, ký tự lạ thành khoảng trắng — để luật viết một lần cho cả chữ Việt có / không dấu. */
export function chuanChu(s: string): string {
  return ` ${s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

type Luat = { re: RegExp; nhom: NhomHienThi; nhomCongTy: string | null; lyDo: string; tru?: RegExp };

// Thứ tự quan trọng: luật trên thắng luật dưới. Cụm từ viết trên chữ ĐÃ BỎ DẤU,
// có khoảng trắng hai đầu để khớp trọn từ (" han " không bắt nhầm "hang").
const LUAT: readonly Luat[] = [
  // ── Hàn cắt: dụng cụ xưởng máy, kể cả găng / kính hàn ──────────────────────
  {
    re: / (weld\w*|welder s?|electrodes?|que han|day han|may han|kinh han|mat na han|han (dien|hoi|cat)|acetylen\w*|axetylen|oxygen|oxy|propane|gas cylinder|cutting (torch|touch)|gas cutting\w*|cutting tips?|bep cat|mo cat|dong ho (chi bao )?ap luc (gas|oxy)|handshield|hand shield) /,
    nhom: "ENGINE",
    nhomCongTy: "TOL",
    lyDo: "hàn cắt — dụng cụ xưởng máy",
  },
  { re: / (refrigerant|gas lanh|r ?407\w*|r ?404\w*|r ?134\w*|r ?22) /, nhom: "ENGINE", nhomCongTy: "REF", lyDo: "môi chất lạnh — máy lạnh" },
  // ── An toàn: cứu sinh, cứu hỏa, y tế, bảo hộ cá nhân ───────────────────────
  {
    re: / (life ?jackets?|phao ao|phao tron|life ?buoys?|lifebuoys?|immersion suits?|life ?rafts?|be cuu sinh|pyrotechnics?|phao hieu|hand flares?|rocket parachute|smoke signals?|line throwing|sung phong day|xuong cuu sinh|lifeboats?|thoat nan|embarkation ladders?) /,
    nhom: "SAFETY",
    nhomCongTy: "LSA",
    lyDo: "trang bị cứu sinh",
  },
  {
    re: / (extinguishers?|binh chua chay|fire ?hoses?|voi chua chay|fire ?blankets?|chan chua chay|fireman s?|breathing apparatus|binh tho|scba|eebd|fire nozzles?|lang phun) /,
    nhom: "SAFETY",
    nhomCongTy: "FFA",
    lyDo: "trang bị cứu hỏa",
  },
  { re: / (first ?aid|so cuu|medicines?|medical|y te|stretchers?|cang cuu thuong|bandages?|bang gac) /, nhom: "SAFETY", nhomCongTy: "MED", lyDo: "y tế, sơ cứu" },
  {
    re: / (may do (nong do )?khi|gas detectors?|multi ?gas|oxygen meters?|luoi an toan|nut lo lu|scupper plugs?|sopep|oil spill\w*) /,
    nhom: "SAFETY",
    nhomCongTy: null,
    lyDo: "thiết bị an toàn, chống ô nhiễm",
  },
  {
    re: / (gloves?|glovers|gang tay|goggles?|kinh bao ho|safety glasses|face ?shields?|dust masks?|masks?|khau trang|respirators?|ear ?plugs?|ear ?muffs?|bit tai|nut tai|helmets?|mu bao ho|hard ?hats?|rubber boots|safety (boots|shoes)|ung cao su|giay bao ho|rain ?suits?|raincoats?|ao mua|coveralls?|boiler ?suits?|quan ao bao ho|safety (harness|belt)|day an toan|lifelines?|reflective vest|ao phan quang) /,
    tru: / (galley|kitchen|bep|dish\w*|cook\w*) /,
    nhom: "SAFETY",
    nhomCongTy: null,
    lyDo: "bảo hộ lao động cá nhân",
  },
  // ── Văn phòng phẩm: thuộc Boong (nhóm DOC, Phó hai) theo bộ phân loại công ty
  {
    re: / (stationery|van phong pham|ball ?pens?|but bi|but chi|pencils?|paper clips?|kep giay|giay a4|a4 (paper|pocket)|folders?|bia ho so|staplers?|dap ghim|ghim bam|markers?|but long|white ?board|bang trang|envelopes?|phong bi|note ?books?|so tay|toner|muc in|printer ink) /,
    nhom: "DECK",
    nhomCongTy: "DOC",
    lyDo: "văn phòng phẩm (thuộc Boong theo bộ phân loại công ty)",
  },
  // ── Điện ────────────────────────────────────────────────────────────────────
  { re: / (bong den|den (led|huynh quang|tuyp|soi dot|pha)|led|lamps?|bulbs?|fluorescent|flash ?lights?|head ?lamps?|den pin|torch light) /, nhom: "ELEC", nhomCongTy: "LIT", lyDo: "đèn, chiếu sáng" },
  { re: / (batter(y|ies)|batery|baterry|ac quy|pin (aa|aaa|9v|tieu|dai|sac)|9 volt) /, nhom: "ELEC", nhomCongTy: "BAT", lyDo: "pin, ắc quy" },
  {
    re: / (fuses?|cau chi|electric(al)? cables?|marine (electric )?cables?|cap dien|day dien|electric(al)? wires?|plugs?|phich cam|o cam|(power|electric|wall) sockets?|cong tac|switch(es)?|insulation tape|bang (keo|dinh) (cach )?dien|test pen|but thu dien|multimeters?|dong ho van nang|megger|relays?|ro le|contactors?|khoi dong tu|aptomat|circuit breakers?|cable ties?|day rut|cable lugs?|dau cos|terminal blocks?) /,
    tru: / (sump|spark plug|bugi|wrench\w*|cle|spanners?) /,
    nhom: "ELEC",
    nhomCongTy: "ELS",
    lyDo: "vật tư điện",
  },
  { re: / (vhf|bo dam|walkie ?talkies?|radios?|gmdss|epirb|sart) /, nhom: "DECK", nhomCongTy: "COM", lyDo: "thông tin liên lạc vô tuyến" },
  // ── Sinh hoạt & Phục vụ: vệ sinh, giặt là, bếp, buồng ở ──────────────────
  { re: / (deck brush\w*|ban chai boong|deck scrub\w*|choi quet boong) /, nhom: "DECK", nhomCongTy: "DST", lyDo: "chổi / bàn chải boong" },
  { re: / (choi son|co son|paint brush\w*|paint rollers?) /, nhom: "DECK", nhomCongTy: "PNT", lyDo: "dụng cụ sơn" },
  {
    re: / (brooms?|broom corns?|choi|cay gat nuoc|squeegees?|gau hot rac|dust ?pans?|soap|xa phong|detergents?|washing powder|bot giat|laundry|nuoc rua|nuoc tay|bleach|cleaners?|chat tay rua|toilet|bon cau|khu mui|air fresheners?|odou?r|insect\w*|cockroach|gian|ant bait|thuoc diet|mops?|cay lau|garbage|tui rac|thung rac|trash|tissue|giay ve sinh|door mats?) /,
    tru: / (ultrason\w*|filters?|phin|degreas\w*|tay dau|fuel|engine|boiler|carbon|nozzle|condenser) /,
    nhom: "SERVICE",
    nhomCongTy: "CLN",
    lyDo: "vệ sinh, giặt là",
  },
  {
    re: / (dishwasher|may rua bat|dish dryer|refrigerators?|tu lanh|freezers?|tu dong|ovens?|lo nuong|rice cooker|noi com|microwave|lo vi song|electric dryer|may say|griddle|deep fryer) /,
    nhom: "SERVICE",
    nhomCongTy: "GAL",
    lyDo: "thiết bị bếp, giặt sấy",
  },
  {
    re: / (plates?|dia an|bowls?|bat an|cups?|mugs?|glasses|fork|nia|spoons?|thia|knives|dao bep|pots?|cooking|chao|kettles?|am dun|trays?|khay|cutting boards?|thot|ladles?|muoi|frying pans?|sauce ?pans?|peelers?|tableware|galley|kitchen|apron|tap de|ash ?trays?|gat tan|balance scales?|can dia|charcoal|than nuong) /,
    nhom: "SERVICE",
    nhomCongTy: "UTN",
    lyDo: "đồ bếp, ăn uống",
  },
  {
    re: / (towels?|khan tam|khan mat|bed ?sheets?|ga trai|pillows?|blankets?|chan len|mattress\w*|dem ngu|curtains?|rem cua|table ?cloth\w*|khan ban|uniforms?) /,
    tru: / (lamella|cach nhiet|insulat\w*|fire) /,
    nhom: "SERVICE",
    nhomCongTy: "LIN",
    lyDo: "đồ vải, buồng ở",
  },
  // ── Boong ───────────────────────────────────────────────────────────────────
  { re: / (lashing|chang buoc container|twist ?locks?|stacking cones?|lashing bars?|bridge fittings?) /, nhom: "DECK", nhomCongTy: "LSH", lyDo: "chằng buộc container" },
  {
    re: / (ropes?|day thung|day (manila|nylon|pp|mooring|neo|cap)|mooring|hawsers?|wire ropes?|cap thep|shackles?|ma ?ni|thimbles?|chan chuot|rat guards?|turnbuckles?|tang do|wire rope clips?|khoa cap) /,
    tru: / (grease|mo) /,
    nhom: "DECK",
    nhomCongTy: "MOR",
    lyDo: "dây, cáp, phụ kiện chằng buộc",
  },
  { re: / (grease wire rope|wire rope grease|mo (den )?boi cap) /, nhom: "DECK", nhomCongTy: "MOR", lyDo: "mỡ bôi cáp" },
  { re: / (paints?|son|thinners?|dung moi son|paint (brush\w*|rollers?)|rollers?|ru lo|rust (primer|converter)) /, nhom: "DECK", nhomCongTy: "PNT", lyDo: "sơn và dụng cụ sơn" },
  {
    re: / (pilot ladders?|cau thang (hoa tieu|day|phu)|rope ladders?|gangway|anchor balls?|bong neo|flags?|co (ban|hieu|quoc|tin hieu)|khoa kho|padlocks?|o khoa|mun cua|sawdust|cement|xi mang|cat vang|tarpaulins?|bat che|canvas|wood(en)? (blocks?|wedges?)|timber|plank\w*|nails?|dinh (sat|thep|tan)|dog bolts?|boatswain s chairs?|sounding|thuoc do nuoc|hai do|nautical charts?|publications?|an pham|binoculars?|ong nhom) /,
    nhom: "DECK",
    nhomCongTy: "DST",
    lyDo: "vật tư, dụng cụ boong",
  },
  // ── Máy: vật tư xưởng máy chỉ dùng cho máy móc ─────────────────────────────
  {
    re: / (bearings?|vong bi|bac dan|gaskets?|gioang|packings?|jointing|teflon|seal tape|cao su non|valves?|van (cau|bi|cong|mot chieu)|pipes?|ong (thep|dong|inox)|elbows?|co han|flanges?|mat bich|valve compound|cat ra|calipers?|thuoc cap|micrometers?|panme|thermometers?|nhiet ke|manometers?|pressure gauges?|dong ho ap|walnut|turbo\w*|filter elements?|loc dau|ultrason\w*|degreas\w*|tay dau|condenser tube|lamella|insulation blanket|asbestos) /,
    tru: / (wrench\w*|cle|spanners?|frying|kitchen|galley) /,
    nhom: "ENGINE",
    nhomCongTy: "TOL",
    lyDo: "vật tư xưởng máy",
  },
];

/** Chương IMPA rõ bản chất (khi tên hàng không khớp luật nào). Chương dùng chung không có ở đây. */
const THEO_CHUONG: Partial<Record<string, Omit<Luat, "re" | "tru">>> = {
  "19": { nhom: "SAFETY", nhomCongTy: null, lyDo: "IMPA 19 quần áo bảo hộ" },
  "31": { nhom: "SAFETY", nhomCongTy: null, lyDo: "IMPA 31 bảo hộ lao động" },
  "33": { nhom: "SAFETY", nhomCongTy: null, lyDo: "IMPA 33 thiết bị an toàn" },
  "39": { nhom: "SAFETY", nhomCongTy: "MED", lyDo: "IMPA 39 thuốc, y tế" },
  "00": { nhom: "SERVICE", nhomCongTy: "LIN", lyDo: "IMPA 00 đồ phúc lợi" },
  "11": { nhom: "SERVICE", nhomCongTy: "PRV", lyDo: "IMPA 11 thực phẩm" },
  "15": { nhom: "SERVICE", nhomCongTy: "LIN", lyDo: "IMPA 15 đồ vải" },
  "53": { nhom: "SERVICE", nhomCongTy: "CLN", lyDo: "IMPA 53 thiết bị vệ sinh" },
  "21": { nhom: "DECK", nhomCongTy: "MOR", lyDo: "IMPA 21 dây, cáp" },
  "25": { nhom: "DECK", nhomCongTy: "PNT", lyDo: "IMPA 25 sơn tàu" },
  "27": { nhom: "DECK", nhomCongTy: "PNT", lyDo: "IMPA 27 dụng cụ sơn" },
  "37": { nhom: "DECK", nhomCongTy: "NAV", lyDo: "IMPA 37 thiết bị hàng hải" },
  "47": { nhom: "DECK", nhomCongTy: "DOC", lyDo: "IMPA 47 văn phòng phẩm" },
  "79": { nhom: "ELEC", nhomCongTy: "ELS", lyDo: "IMPA 79 thiết bị điện" },
  "85": { nhom: "ENGINE", nhomCongTy: "TOL", lyDo: "IMPA 85 hàn cắt" },
};

/**
 * Bản chất của một VẬT TƯ (Store): nhóm hiển thị + nhóm con công ty + lý do.
 * null = không đủ căn cứ (hàng dùng chung, hoặc phụ tùng) — giữ cách xếp cũ.
 */
export function banChatVatTu(m: { nameVn: string; nameEn?: string | null; impa?: string | null; materialType: string }): BanChat | null {
  if (m.materialType === "SPARE") return null;
  const chu = chuanChu(`${m.nameVn} ${m.nameEn ?? ""}`);
  for (const l of LUAT) {
    if (l.re.test(chu) && !(l.tru && l.tru.test(chu))) return { nhom: l.nhom, nhomCongTy: l.nhomCongTy, lyDo: l.lyDo };
  }
  const ch = chuongImpa(m.impa);
  const theoChuong = ch ? THEO_CHUONG[ch] : undefined;
  return theoChuong ? { ...theoChuong } : null;
}

export type VatTuPhanNhom = {
  nameVn?: string | null;
  nameEn?: string | null;
  impa?: string | null;
  materialType: string;
  code?: string | null;
  department?: string | null;
  categoryName?: string | null;
  equipment?: string | null;
  /** Nhóm quản trị GHIM tay (cột Material.nhomQuanLy) — thắng mọi suy luận. */
  nhomQuanLy?: string | null;
  /** Chuỗi phụ để đoán như cũ khi không có mã (VD mã kho ở trang Tồn kho). */
  nguonPhu?: string | null;
};

export type KetQuaPhanNhom = {
  nhom: string;
  banChat: BanChat | null;
  /** ghim: quản trị chọn · ban-chat: theo bản chất · cu: cách xếp cũ (theo sheet / thiết bị / mã). */
  nguon: "ghim" | "ban-chat" | "cu";
  /** Nhóm theo cách xếp cũ — để biết mặt hàng có được CHUYỂN nhóm không. */
  nhomCu: string;
};

const THEO_CHU_MA: Record<string, NhomHienThi> = { D: "DECK", E: "ENGINE", L: "ELEC", C: "SERVICE" };

/**
 * Nhóm hiển thị (Boong · Máy · Điện · Sinh hoạt & Phục vụ · An toàn chung) của
 * một mặt hàng — MỘT hàm cho trang Danh mục, Tồn kho và cột "Giữ bởi":
 *   1. quản trị ghim tay (nhomQuanLy);
 *   2. bản chất (banChatVatTu: tên hàng, chương IMPA);
 *   3. cách xếp cũ (theo nhóm file nhập / thiết bị) — riêng "An toàn chung"
 *      chỉ giữ hàng có bản chất an toàn: món lọt vào đó chỉ vì nằm trong sheet
 *      "Vật tư bảo hộ & an toàn" (thước rút, giẻ lau...) về lại bộ phận theo
 *      chữ đầu mã.
 */
export function nhomCuaVatTu(m: VatTuPhanNhom): KetQuaPhanNhom {
  const nhomCu = departmentOfMaterial([m.categoryName, m.equipment, m.nguonPhu ?? m.code], m.materialType, m.department);
  const bc = banChatVatTu({ nameVn: m.nameVn ?? "", nameEn: m.nameEn, impa: m.impa, materialType: m.materialType });
  const ghim = (m.nhomQuanLy ?? "").trim().toUpperCase();
  if ((NHOM_HIEN_THI as readonly string[]).includes(ghim)) return { nhom: ghim, banChat: bc, nguon: "ghim", nhomCu };
  if (bc) return { nhom: bc.nhom, banChat: bc, nguon: "ban-chat", nhomCu };
  if (nhomCu === "SAFETY" && m.materialType !== "SPARE") {
    const chu = /^([DELC])-/i.exec(m.code ?? "")?.[1]?.toUpperCase();
    return { nhom: (chu && THEO_CHU_MA[chu]) || "DECK", banChat: null, nguon: "cu", nhomCu };
  }
  return { nhom: nhomCu, banChat: null, nguon: "cu", nhomCu };
}
