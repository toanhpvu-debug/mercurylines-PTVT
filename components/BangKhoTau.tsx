"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Pencil, Plus, Save, Trash2, Warehouse } from "lucide-react";
import { chuyenHangSangKho, layHangTrongKho, luuKhoTau, xoaKhoTau } from "@/app/kho-tau-actions";
import {
  DO_DAI_HAU_TO,
  DO_DAI_TEN_KHO,
  LOAI_KHO,
  VI_TRI_GOI_Y,
  chuanHoaHauTo,
  hauToKho,
  khongDau,
  laKhoCuoiCuaKhoi,
  loaiKhoTuMa,
  maKho,
  tenKhoNgan,
  type HangTrongKho,
  type LoaiKho,
} from "@/lib/khoTau";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, EmptyState, Field, Input, Notice, Select, Table, TableWrap, Td, Th, Tr, type Tone } from "@/components/ui";
import { Modal } from "@/components/ui-client";

/*
 * Mục "Kho trên tàu" của hồ sơ tàu: danh sách kho / vị trí cất hàng, và — với Thuyền trưởng / Máy
 * trưởng của tàu, quản trị — thêm, sửa, xóa kho, chuyển hàng sang kho khác. Quy ước mã: lib/khoTau.ts.
 */

export type KhoDong = { id: number; code: string; name: string; soMatHang: number; soGiaoDich: number };
type Tau = { id: number; code: string; name: string };
type Hop = { kieu: "them" } | { kieu: "sua"; kho: KhoDong } | { kieu: "chuyen"; kho: KhoDong };

const TONE_KHOI: Record<LoaiKho, Tone> = { ENG: "info", DECK: "brand", STORE: "neutral" };

function useNhanKhoi() {
  const { t } = useNgonNgu();
  return (loai: LoaiKho | null) =>
    loai === "ENG" ? t("vessels.khoi_ENG") : loai === "DECK" ? t("vessels.khoi_DECK") : loai === "STORE" ? t("vessels.khoi_STORE") : t("vessels.khoi_khac");
}

export default function BangKhoTau({ tau, kho, quanLy, vanPhong }: { tau: Tau; kho: KhoDong[]; quanLy: boolean; vanPhong: boolean }) {
  const { t, so } = useNgonNgu();
  const nhanKhoi = useNhanKhoi();
  const router = useRouter();
  const [hop, setHop] = useState<Hop | null>(null);
  const [bao, setBao] = useState<{ tone: Tone; chu: string } | null>(null);
  const [dangXoa, startXoa] = useTransition();

  const xong = (chu: string) => {
    setHop(null);
    setBao({ tone: "success", chu });
    router.refresh();
  };
  const xoa = (k: KhoDong) => {
    if (!window.confirm(t("vessels.kho_xacNhanXoa", { ma: k.code, ten: tenKhoNgan(k.name, tau.name) }))) return;
    startXoa(async () => {
      const kq = await xoaKhoTau(k.id);
      setBao({ tone: kq.success ? "success" : "danger", chu: kq.message });
      if (kq.success) router.refresh();
    });
  };
  /** Vì sao chưa xóa được (chữ của nút xóa bị khóa); null = xóa được. */
  const lyDoKhongXoa = (k: KhoDong) => {
    const cuoi = laKhoCuoiCuaKhoi(k, kho);
    return !vanPhong
      ? t("vessels.kho_chiVanPhong")
      : k.soMatHang
        ? t("vessels.kho_conHang", { n: k.soMatHang })
        : k.soGiaoDich
          ? t("vessels.kho_conLichSu", { n: k.soGiaoDich })
          : cuoi
            ? t("vessels.kho_cuoiCungCuaKhoi", { khoi: nhanKhoi(cuoi) })
            : null;
  };

  return (
    <div className="space-y-3">
      {quanLy && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setHop({ kieu: "them" })}>
            {t("vessels.kho_them")}
          </Button>
          <span className="text-xs text-[var(--text-muted)]">{t("vessels.kho_goiYQuanLy")}</span>
        </div>
      )}
      {bao && (
        <Notice tone={bao.tone}>
          <span className="flex items-start justify-between gap-3">
            <span>{bao.chu}</span>
            <button type="button" className="text-xs underline" onClick={() => setBao(null)}>
              {t("chung.dong")}
            </button>
          </span>
        </Notice>
      )}
      {kho.length === 0 ? (
        <EmptyState icon={<Warehouse className="size-5" />} title={t("vessels.chuaCoKho")} hint={quanLy ? t("vessels.kho_chuaCoKhoGoiY") : undefined} />
      ) : (
        <TableWrap>
          <Table dense xuongDong>
            <thead>
              <tr>
                <Th>{t("vessels.cotMaKho")}</Th>
                <Th>{t("vessels.cotTenKho")}</Th>
                <Th>{t("vessels.cot_khoi")}</Th>
                <Th align="right">{t("vessels.cot_soMatHang")}</Th>
                {quanLy && <Th>{t("chung.thaoTac")}</Th>}
              </tr>
            </thead>
            <tbody>
              {kho.map((k) => {
                const loai = loaiKhoTuMa(k.code);
                const khongXoa = lyDoKhongXoa(k);
                return (
                  <Tr key={k.id} className="transition-colors hover:bg-[var(--surface-sunken)]/50">
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap">{k.code}</Td>
                    <Td className="font-medium">{tenKhoNgan(k.name, tau.name)}</Td>
                    <Td>
                      <Badge tone={loai ? TONE_KHOI[loai] : "muted"}>{nhanKhoi(loai)}</Badge>
                    </Td>
                    <Td align="right" className="tabular">
                      {k.soMatHang ? (
                        <Link href={`/inventory?vessel=${tau.id}&wh=${k.id}`} className="text-brand-700 hover:underline dark:text-brand-300">
                          {so(k.soMatHang)}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </Td>
                    {quanLy && (
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <Button type="button" size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setHop({ kieu: "sua", kho: k })}>
                            {t("chung.sua")}
                          </Button>
                          {k.soMatHang > 0 && kho.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              icon={<ArrowRightLeft className="size-4" />}
                              disabled={!vanPhong}
                              title={vanPhong ? undefined : t("vessels.kho_chiVanPhong")}
                              onClick={() => setHop({ kieu: "chuyen", kho: k })}
                            >
                              {t("vessels.kho_chuyenHang")}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 className="size-4" />}
                            disabled={!!khongXoa || dangXoa}
                            title={khongXoa ?? undefined}
                            onClick={() => xoa(k)}
                          >
                            {t("chung.xoa")}
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
      {hop?.kieu === "them" && <HopKho tau={tau} kho={null} tatCa={kho} dong={() => setHop(null)} xong={xong} />}
      {hop?.kieu === "sua" && <HopKho tau={tau} kho={hop.kho} tatCa={kho} dong={() => setHop(null)} xong={xong} />}
      {hop?.kieu === "chuyen" && <HopChuyen tau={tau} tu={hop.kho} tatCa={kho} dong={() => setHop(null)} xong={xong} />}
    </div>
  );
}

/** Hộp thêm / sửa một kho: chọn nhanh chỗ cất trên tàu, khối, tên, mã vị trí — xem trước mã kho. */
function HopKho({ tau, kho, tatCa, dong, xong }: { tau: Tau; kho: KhoDong | null; tatCa: KhoDong[]; dong: () => void; xong: (chu: string) => void }) {
  const { t, tTuDo } = useNgonNgu();
  const nhanKhoi = useNhanKhoi();
  const [loai, setLoai] = useState<LoaiKho>(kho ? (loaiKhoTuMa(kho.code) ?? "STORE") : "ENG");
  const [ten, setTen] = useState(kho ? tenKhoNgan(kho.name, tau.name) : "");
  const [hauTo, setHauTo] = useState(kho ? hauToKho(kho.code) : "");
  // Mã vị trí tự theo tên cho tới khi người dùng gõ / chọn mã riêng.
  const [hauToRieng, setHauToRieng] = useState(kho !== null);
  const [loi, setLoi] = useState("");
  const [pending, start] = useTransition();

  const ma = maKho(tau.code, loai, hauTo);
  const trungMa = tatCa.some((k) => k.code === ma && k.id !== kho?.id);
  const loaiCu = kho ? loaiKhoTuMa(kho.code) : null;
  const doiKhoi = kho !== null && kho.soMatHang + kho.soGiaoDich > 0 && loaiCu !== loai;
  // Kho cuối cùng của khối không đổi khối được (nhập file / kiểm kê "tự động" cần mỗi khối một kho).
  const khoiCuoi = kho !== null && loaiCu !== loai ? laKhoCuoiCuaKhoi(kho, tatCa) : null;

  const chonViTri = (khoa: string) => {
    const v = VI_TRI_GOI_Y.find((x) => x.khoa === khoa);
    if (!v) return;
    setLoai(v.loai);
    setTen(`${tTuDo(`thietYeu.viTri_${v.khoa}`)} (${v.ma})`);
    setHauTo(v.hauTo);
    setHauToRieng(true);
  };
  const luu = () =>
    start(async () => {
      setLoi("");
      const kq = await luuKhoTau({ vesselId: tau.id, id: kho?.id ?? null, loai, hauTo, ten });
      if (kq.success) xong(kq.message);
      else setLoi(kq.message);
    });

  return (
    <Modal open onClose={dong} title={kho ? t("vessels.kho_hopSua", { ma: kho.code }) : t("vessels.kho_hopThem", { tau: `${tau.code} — ${tau.name}` })} width="max-w-xl">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          luu();
        }}
      >
        {!kho && (
          <Field label={t("vessels.kho_viTriCoSan")} hint={t("vessels.kho_viTriCoSanGoiY")}>
            <Select defaultValue="" onChange={(e) => chonViTri(e.target.value)}>
              <option value="">{t("vessels.kho_tuGo")}</option>
              {VI_TRI_GOI_Y.map((v) => (
                <option key={v.khoa} value={v.khoa}>
                  {tTuDo(`thietYeu.viTri_${v.khoa}`)} ({v.ma}) — {nhanKhoi(v.loai)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("vessels.cotTenKho")} hint={t("vessels.kho_tenGoiY", { ten: `${ten.trim() || "…"} - ${tau.name}` })}>
          <Input
            value={ten}
            maxLength={DO_DAI_TEN_KHO}
            required
            autoFocus
            onChange={(e) => {
              setTen(e.target.value);
              if (!hauToRieng) setHauTo(chuanHoaHauTo(e.target.value));
            }}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("vessels.kho_khoi")} hint={t("vessels.kho_khoiGoiY")}>
            <Select value={loai} onChange={(e) => setLoai(e.target.value as LoaiKho)}>
              {LOAI_KHO.map((l) => (
                <option key={l} value={l}>
                  {nhanKhoi(l)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("vessels.kho_maViTri")} hint={t("vessels.kho_maViTriGoiY", { n: DO_DAI_HAU_TO })}>
            <Input
              value={hauTo}
              maxLength={DO_DAI_HAU_TO + 8}
              onChange={(e) => {
                setHauTo(e.target.value);
                setHauToRieng(true);
              }}
              onBlur={() => setHauTo(chuanHoaHauTo(hauTo))}
            />
          </Field>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {t("vessels.kho_maSeLa")} <span className="font-display tracking-wide text-[var(--text-primary)]">{ma}</span>
        </p>
        {trungMa && <Notice tone="danger">{t("vessels.kho_maDaCo", { ma })}</Notice>}
        {khoiCuoi ? (
          <Notice tone="danger">{t("vessels.kho_khongDoiKhoiCuoi", { khoi: nhanKhoi(khoiCuoi) })}</Notice>
        ) : (
          doiKhoi && kho && <Notice tone="warning">{t("vessels.kho_doiKhoiCanhBao", { n: kho.soMatHang, khoi: nhanKhoi(loai) })}</Notice>
        )}
        {loi && <Notice tone="danger">{loi}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={dong}>
            {t("chung.huy")}
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={trungMa || !!khoiCuoi || !ten.trim()} icon={<Save className="size-4" />}>
            {t("chung.luu")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Hộp chuyển hàng: chọn kho đích, lọc, đánh dấu mặt hàng — hàng và lịch sử của nó đi theo. */
function HopChuyen({ tau, tu, tatCa, dong, xong }: { tau: Tau; tu: KhoDong; tatCa: KhoDong[]; dong: () => void; xong: (chu: string) => void }) {
  const { t, so } = useNgonNgu();
  const nhanKhoi = useNhanKhoi();
  const [hang, setHang] = useState<HangTrongKho[] | null>(null);
  const [loi, setLoi] = useState("");
  const [den, setDen] = useState("");
  const [loc, setLoc] = useState("");
  const [chon, setChon] = useState<Set<number>>(() => new Set());
  const [pending, start] = useTransition();

  useEffect(() => {
    let boQua = false;
    layHangTrongKho(tu.id).then((kq) => {
      if (boQua) return;
      if (kq.hang) setHang(kq.hang);
      else setLoi(kq.message);
    });
    return () => {
      boQua = true;
    };
  }, [tu.id]);

  const khoKhac = tatCa.filter((k) => k.id !== tu.id);
  const denKho = khoKhac.find((k) => String(k.id) === den) ?? null;
  const loaiTu = loaiKhoTuMa(tu.code);
  const loaiDen = denKho ? loaiKhoTuMa(denKho.code) : null;
  const tim = khongDau(loc.trim());
  const hien = useMemo(() => (hang ?? []).filter((h) => !tim || khongDau(`${h.ma} ${h.ten}`).includes(tim)), [hang, tim]);
  const hetHienDaChon = hien.length > 0 && hien.every((h) => chon.has(h.id));
  const doiTatCa = () =>
    setChon((c) => {
      const n = new Set(c);
      for (const h of hien) {
        if (hetHienDaChon) n.delete(h.id);
        else n.add(h.id);
      }
      return n;
    });
  const doiMot = (id: number) =>
    setChon((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const chuyen = () =>
    start(async () => {
      setLoi("");
      const kq = await chuyenHangSangKho(tu.id, Number(den), [...chon]);
      if (kq.success) xong(kq.message);
      else setLoi(kq.message);
    });

  return (
    <Modal open onClose={dong} title={t("vessels.kho_hopChuyen", { ma: tu.code, ten: tenKhoNgan(tu.name, tau.name) })} width="max-w-3xl">
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">{t("vessels.kho_giaiThichChuyen")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("vessels.kho_sangKho")}>
            <Select value={den} onChange={(e) => setDen(e.target.value)}>
              <option value="">{t("vessels.kho_chonKhoDich")}</option>
              {khoKhac.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.code} — {tenKhoNgan(k.name, tau.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("vessels.kho_timHang")}>
            <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t("vessels.kho_timHangGoiY")} />
          </Field>
        </div>
        {denKho && loaiTu !== loaiDen && <Notice tone="warning">{t("vessels.kho_khacKhoiCanhBao", { tu: nhanKhoi(loaiTu), den: nhanKhoi(loaiDen) })}</Notice>}
        {hang === null && !loi ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("chung.dangTai")}</p>
        ) : hang && hang.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("vessels.kho_khongCoHang")}</p>
        ) : hang ? (
          // Cuộn riêng, tiêu đề ghim: kho vài trăm mặt hàng thì nút "Chuyển" bên dưới vẫn luôn thấy.
          <TableWrap className="max-h-[45vh] overflow-y-auto">
            <Table dense xuongDong>
              <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                <tr>
                  <Th className="w-8">
                    <input type="checkbox" aria-label={t("vessels.kho_chonTatCa", { n: hien.length })} checked={hetHienDaChon} onChange={doiTatCa} />
                  </Th>
                  <Th>{t("vessels.cotMaVatTu")}</Th>
                  <Th>{t("vessels.cotTenVatTu")}</Th>
                  <Th align="right">{t("vessels.cotTon")}</Th>
                  <Th>{t("vessels.kho_oKhoDich")}</Th>
                </tr>
              </thead>
              <tbody>
                {hien.map((h) => {
                  const coSan = denKho ? h.khoKhac.find((x) => x.khoId === denKho.id) : undefined;
                  return (
                    // Bấm cả dòng là đánh dấu (ô tick nhỏ khó trúng) — Tr của ui.tsx không nhận onClick.
                    <tr key={h.id} className="cursor-pointer last:[&>td]:border-b-0 hover:bg-[var(--surface-sunken)]/50" onClick={() => doiMot(h.id)}>
                      <Td>
                        <input type="checkbox" aria-label={h.ma} checked={chon.has(h.id)} onChange={() => doiMot(h.id)} onClick={(e) => e.stopPropagation()} />
                      </Td>
                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">{h.ma}</Td>
                      <Td>{h.ten}</Td>
                      <Td align="right" className="tabular whitespace-nowrap">
                        {so(h.ton)} <span className="text-xs text-[var(--text-muted)]">{h.dvt}</span>
                        {h.giu > 0 && <span className="block text-xs text-[var(--text-muted)]">{t("vessels.kho_dangGiu", { n: so(h.giu) })}</span>}
                      </Td>
                      <Td className="text-xs text-[var(--text-secondary)]">{coSan ? t("vessels.kho_coSanODich", { n: so(coSan.so) }) : ""}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : null}
        {loi && <Notice tone="danger">{loi}</Notice>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-muted)]">
            {hang ? t("vessels.kho_daChon", { n: chon.size, tong: hang.length }) : ""}
            {hang && hien.length > 0 && (
              <button type="button" className="ml-3 underline" onClick={doiTatCa}>
                {hetHienDaChon ? t("vessels.kho_boChonDangHien") : t("vessels.kho_chonTatCa", { n: hien.length })}
              </button>
            )}
          </span>
          <div className="flex gap-2">
            <Button type="button" onClick={dong}>
              {t("chung.huy")}
            </Button>
            <Button type="button" variant="primary" loading={pending} disabled={!denKho || chon.size === 0} icon={<ArrowRightLeft className="size-4" />} onClick={chuyen}>
              {t("vessels.kho_nutChuyen", { n: chon.size })}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
