"use client";

import { useState, useEffect } from "react";

// ---- 型定義 ----
interface HoleScore {
  hole: number;
  par: number;
  score: number;
  putts: number;
  fairway: boolean | null; // par3はnull
  gir: boolean;
}

interface Round {
  id: string;
  date: string;
  courseName: string;
  holes: HoleScore[];
  memo: string;
}

interface PracticeSession {
  id: string;
  date: string;
  location: string;
  duration: number; // 分
  balls: number;
  clubs: string[];      // クラブ種別
  bodyParts: string[];  // 観点（体の動き）
  theme: string;
  memo: string;
}

type Tab = "round" | "practice" | "analysis";
type RoundView = "list" | "new" | "input" | "detail";
type PracticeView = "list" | "new" | "detail";

const CLUB_CATEGORIES = [
  { key: "driver", label: "ドライバー" },
  { key: "iron", label: "アイアン" },
  { key: "wedge", label: "ウェッジ" },
  { key: "approach", label: "アプローチ" },
  { key: "bunker", label: "バンカー" },
  { key: "putt", label: "パター" },
  { key: "other", label: "その他" },
];

const BODY_PART_CATEGORIES = [
  { key: "upper", label: "上半身" },
  { key: "lower", label: "下半身" },
  { key: "hands", label: "手元" },
  { key: "whole", label: "全体" },
];

const LOCATIONS = ["打ちっぱなし", "コース", "自宅", "室内練習場", "その他"];

const DEFAULT_PARS = [4,4,3,4,5,4,3,4,5, 4,4,3,4,5,4,3,4,5];

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE");
}

function today() {
  return toDateStr(new Date());
}

function calcTotal(holes: HoleScore[]) {
  return holes.reduce((s, h) => s + h.score, 0);
}

function calcTotalPutts(holes: HoleScore[]) {
  return holes.reduce((s, h) => s + h.putts, 0);
}

function calcOverUnder(holes: HoleScore[]) {
  const diff = holes.reduce((s, h) => s + (h.score - h.par), 0);
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function fairwayRate(holes: HoleScore[]) {
  const fw = holes.filter(h => h.par !== 3);
  if (fw.length === 0) return null;
  const hit = fw.filter(h => h.fairway).length;
  return Math.round((hit / fw.length) * 100);
}

function girRate(holes: HoleScore[]) {
  const hit = holes.filter(h => h.gir).length;
  return Math.round((hit / holes.length) * 100);
}

function weaknessAnalysis(round: Round): string[] {
  const issues: string[] = [];
  const avgPutts = calcTotalPutts(round.holes) / round.holes.length;
  const fw = fairwayRate(round.holes);
  const gir = girRate(round.holes);

  if (avgPutts >= 2.2) issues.push(`パット数が多め（平均${avgPutts.toFixed(1)}）→ パター練習を優先`);
  if (fw !== null && fw < 50) issues.push(`FW安打率が低い（${fw}%）→ ドライバーの方向性を改善`);
  if (gir < 30) issues.push(`GIR率が低い（${gir}%）→ アイアン・アプローチの精度アップ`);

  const par3holes = round.holes.filter(h => h.par === 3);
  const par3avg = par3holes.length > 0
    ? par3holes.reduce((s, h) => s + (h.score - h.par), 0) / par3holes.length
    : 0;
  if (par3avg > 0.5) issues.push(`ショートホールで叩きやすい（平均+${par3avg.toFixed(1)}）→ ティーショットの精度`);

  const par5holes = round.holes.filter(h => h.par === 5);
  const par5avg = par5holes.length > 0
    ? par5holes.reduce((s, h) => s + (h.score - h.par), 0) / par5holes.length
    : 0;
  if (par5avg > 1.0) issues.push(`ロングホールで崩れやすい（平均+${par5avg.toFixed(1)}）→ 2打目・3打目の安定性`);

  if (issues.length === 0) issues.push("特に大きな弱点は見当たりません。引き続き維持を！");
  return issues;
}

// ---- カウンターボタン ----
function Counter({ value, onChange, min = 0, max = 15 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center"
      >−</button>
      <span className="w-6 text-center font-bold text-gray-900">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center"
      >＋</button>
    </div>
  );
}

// ---- メインコンポーネント ----
export default function GolfTracker() {
  const [tab, setTab] = useState<Tab>("round");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [practices, setPractices] = useState<PracticeSession[]>([]);

  // ラウンド
  const [roundView, setRoundView] = useState<RoundView>("list");
  const [newRound, setNewRound] = useState<Partial<Round>>({});
  const [editingHoles, setEditingHoles] = useState<HoleScore[]>([]);
  const [currentHole, setCurrentHole] = useState(0);
  const [detailRound, setDetailRound] = useState<Round | null>(null);

  // 練習
  const [practiceView, setPracticeView] = useState<PracticeView>("list");
  const [newPractice, setNewPractice] = useState<Partial<PracticeSession>>({});
  const [detailPractice, setDetailPractice] = useState<PracticeSession | null>(null);

  useEffect(() => {
    const r = localStorage.getItem("golf-rounds");
    const p = localStorage.getItem("golf-practices");
    if (r) setRounds(JSON.parse(r));
    if (p) setPractices(JSON.parse(p));
  }, []);

  function saveRounds(r: Round[]) {
    setRounds(r);
    localStorage.setItem("golf-rounds", JSON.stringify(r));
  }

  function savePractices(p: PracticeSession[]) {
    setPractices(p);
    localStorage.setItem("golf-practices", JSON.stringify(p));
  }

  // ---- ラウンド新規作成 ----
  function startNewRound() {
    setNewRound({ date: today(), courseName: "", memo: "" });
    setRoundView("new");
  }

  function proceedToInput() {
    if (!newRound.courseName?.trim()) return;
    const holes: HoleScore[] = DEFAULT_PARS.map((par, i) => ({
      hole: i + 1,
      par,
      score: par,
      putts: 2,
      fairway: par !== 3 ? true : null,
      gir: false,
    }));
    setEditingHoles(holes);
    setCurrentHole(0);
    setRoundView("input");
  }

  function updateHole(field: keyof HoleScore, value: number | boolean | null) {
    setEditingHoles(prev => prev.map((h, i) =>
      i === currentHole ? { ...h, [field]: value } : h
    ));
  }

  function saveRound() {
    const round: Round = {
      id: Date.now().toString(),
      date: newRound.date ?? today(),
      courseName: newRound.courseName ?? "",
      holes: editingHoles,
      memo: newRound.memo ?? "",
    };
    saveRounds([round, ...rounds]);
    setRoundView("list");
  }

  function deleteRound(id: string) {
    if (!confirm("このラウンドを削除しますか？")) return;
    saveRounds(rounds.filter(r => r.id !== id));
    setDetailRound(null);
    setRoundView("list");
  }

  // ---- 練習新規作成 ----
  function startNewPractice() {
    setNewPractice({
      date: today(),
      location: LOCATIONS[0],
      duration: 60,
      balls: 100,
      clubs: [],
      bodyParts: [],
      theme: "",
      memo: "",
    });
    setPracticeView("new");
  }

  function savePractice() {
    if (!newPractice.theme?.trim() && !newPractice.clubs?.length && !newPractice.bodyParts?.length) return;
    const session: PracticeSession = {
      id: Date.now().toString(),
      date: newPractice.date ?? today(),
      location: newPractice.location ?? LOCATIONS[0],
      duration: newPractice.duration ?? 60,
      balls: newPractice.balls ?? 0,
      clubs: newPractice.clubs ?? [],
      bodyParts: newPractice.bodyParts ?? [],
      theme: newPractice.theme ?? "",
      memo: newPractice.memo ?? "",
    };
    savePractices([session, ...practices]);
    setPracticeView("list");
  }

  function deletePractice(id: string) {
    if (!confirm("この練習記録を削除しますか？")) return;
    savePractices(practices.filter(p => p.id !== id));
    setDetailPractice(null);
    setPracticeView("list");
  }

  function toggleClub(key: string) {
    const clubs = newPractice.clubs ?? [];
    setNewPractice(prev => ({
      ...prev,
      clubs: clubs.includes(key) ? clubs.filter(c => c !== key) : [...clubs, key],
    }));
  }

  function toggleBodyPart(key: string) {
    const parts = newPractice.bodyParts ?? [];
    setNewPractice(prev => ({
      ...prev,
      bodyParts: parts.includes(key) ? parts.filter(c => c !== key) : [...parts, key],
    }));
  }

  const hole = editingHoles[currentHole];
  const overUnderColor = (v: number) =>
    v < 0 ? "text-blue-600" : v > 0 ? "text-red-500" : "text-gray-600";

  // ---- 分析データ ----
  const avgScore = rounds.length > 0
    ? (rounds.reduce((s, r) => s + calcTotal(r.holes), 0) / rounds.length).toFixed(1)
    : null;
  const bestScore = rounds.length > 0
    ? Math.min(...rounds.map(r => calcTotal(r.holes)))
    : null;
  const totalPracticeMin = practices.reduce((s, p) => s + p.duration, 0);
  const recentRounds = rounds.slice(0, 5);

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-green-700 text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">⛳</span>
          <h1 className="text-lg font-bold">ゴルフ上達ノート</h1>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="pb-24">

        {/* ===== ラウンドタブ ===== */}
        {tab === "round" && (
          <div>
            {/* ラウンド一覧 */}
            {roundView === "list" && (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-gray-800">ラウンド記録</h2>
                  <button
                    onClick={startNewRound}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >＋ 記録する</button>
                </div>
                {rounds.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">⛳</p>
                    <p className="text-sm">ラウンドを記録しよう</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rounds.map(r => {
                      const total = calcTotal(r.holes);
                      const ou = calcOverUnder(r.holes);
                      const ouNum = r.holes.reduce((s, h) => s + (h.score - h.par), 0);
                      return (
                        <div
                          key={r.id}
                          onClick={() => { setDetailRound(r); setRoundView("detail"); }}
                          className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-green-400"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-800">{r.courseName}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{r.date}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-800">{total}</p>
                              <p className={`text-sm font-medium ${overUnderColor(ouNum)}`}>{ou}</p>
                            </div>
                          </div>
                          <div className="flex gap-4 mt-3 text-xs text-gray-500">
                            <span>パット {calcTotalPutts(r.holes)}</span>
                            {fairwayRate(r.holes) !== null && <span>FW {fairwayRate(r.holes)}%</span>}
                            <span>GIR {girRate(r.holes)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 新規ラウンド基本情報 */}
            {roundView === "new" && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setRoundView("list")} className="text-gray-500">←</button>
                  <h2 className="font-bold text-gray-800">ラウンド情報</h2>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">日付</label>
                    <input
                      type="date"
                      value={newRound.date ?? today()}
                      onChange={e => setNewRound(p => ({ ...p, date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">コース名</label>
                    <input
                      type="text"
                      value={newRound.courseName ?? ""}
                      onChange={e => setNewRound(p => ({ ...p, courseName: e.target.value }))}
                      placeholder="例：○○ゴルフ倶楽部"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">メモ（任意）</label>
                    <textarea
                      value={newRound.memo ?? ""}
                      onChange={e => setNewRound(p => ({ ...p, memo: e.target.value }))}
                      placeholder="天候・同伴者など"
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
                    />
                  </div>
                </div>
                <button
                  onClick={proceedToInput}
                  disabled={!newRound.courseName?.trim()}
                  className="w-full mt-4 bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-40"
                >
                  スコア入力へ →
                </button>
              </div>
            )}

            {/* ホール別スコア入力 */}
            {roundView === "input" && hole && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setRoundView("new")} className="text-gray-500">←</button>
                  <h2 className="font-bold text-gray-800">スコア入力</h2>
                </div>

                {/* 進捗バー */}
                <div className="flex gap-1 mb-4">
                  {editingHoles.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentHole(i)}
                      className={`flex-1 h-2 rounded-full ${
                        i < currentHole ? "bg-green-500" :
                        i === currentHole ? "bg-green-700" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>

                {/* ホール情報 */}
                <div className="bg-green-700 text-white rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm opacity-80">HOLE</p>
                      <p className="text-4xl font-bold">{hole.hole}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-80">PAR</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateHole("par", Math.max(3, hole.par - 1))} className="text-white opacity-70 text-xl">−</button>
                        <p className="text-4xl font-bold">{hole.par}</p>
                        <button onClick={() => updateHole("par", Math.min(5, hole.par + 1))} className="text-white opacity-70 text-xl">＋</button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-80">スコア</p>
                      <p className={`text-2xl font-bold ${hole.score - hole.par < 0 ? "text-yellow-300" : hole.score - hole.par > 0 ? "text-red-300" : "text-white"}`}>
                        {calcOverUnder([hole])}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-5">
                  {/* スコア */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-800">スコア</p>
                      <p className="text-xs text-gray-400">打数</p>
                    </div>
                    <Counter value={hole.score} onChange={v => updateHole("score", v)} min={1} max={15} />
                  </div>

                  {/* パット */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-800">パット数</p>
                      <p className="text-xs text-gray-400">グリーン上の打数</p>
                    </div>
                    <Counter value={hole.putts} onChange={v => updateHole("putts", v)} min={0} max={8} />
                  </div>

                  {/* FW安打（par4,5のみ） */}
                  {hole.par !== 3 && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800">フェアウェイキープ</p>
                        <p className="text-xs text-gray-400">ティーショット</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateHole("fairway", true)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${hole.fairway === true ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}
                        >○</button>
                        <button
                          onClick={() => updateHole("fairway", false)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${hole.fairway === false ? "bg-red-400 text-white" : "bg-gray-100 text-gray-600"}`}
                        >✕</button>
                      </div>
                    </div>
                  )}

                  {/* GIR */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-800">GIR</p>
                      <p className="text-xs text-gray-400">規定打数内でグリーンオン</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateHole("gir", true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${hole.gir ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}
                      >○</button>
                      <button
                        onClick={() => updateHole("gir", false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${!hole.gir ? "bg-red-400 text-white" : "bg-gray-100 text-gray-600"}`}
                      >✕</button>
                    </div>
                  </div>
                </div>

                {/* ナビゲーション */}
                <div className="flex gap-3 mt-4">
                  {currentHole > 0 && (
                    <button
                      onClick={() => setCurrentHole(currentHole - 1)}
                      className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium"
                    >← 前のホール</button>
                  )}
                  {currentHole < editingHoles.length - 1 ? (
                    <button
                      onClick={() => setCurrentHole(currentHole + 1)}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium"
                    >次のホール →</button>
                  ) : (
                    <button
                      onClick={saveRound}
                      className="flex-1 py-3 bg-green-700 text-white rounded-xl font-bold"
                    >🏁 保存する</button>
                  )}
                </div>

                {/* 現在の合計 */}
                <div className="mt-3 bg-gray-100 rounded-xl p-3 flex justify-between text-sm text-gray-600">
                  <span>現在の合計</span>
                  <span className="font-bold">
                    {editingHoles.slice(0, currentHole + 1).reduce((s, h) => s + h.score, 0)} 打
                    （{calcOverUnder(editingHoles.slice(0, currentHole + 1))}）
                  </span>
                </div>
              </div>
            )}

            {/* ラウンド詳細 */}
            {roundView === "detail" && detailRound && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRoundView("list")} className="text-gray-500">←</button>
                    <h2 className="font-bold text-gray-800">{detailRound.courseName}</h2>
                  </div>
                  <button onClick={() => deleteRound(detailRound.id)} className="text-red-400 text-sm">削除</button>
                </div>

                {/* サマリー */}
                <div className="bg-green-700 text-white rounded-xl p-4 mb-4">
                  <p className="text-sm opacity-80 mb-1">{detailRound.date}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-5xl font-bold">{calcTotal(detailRound.holes)}</p>
                      <p className="text-lg font-medium opacity-90">{calcOverUnder(detailRound.holes)}</p>
                    </div>
                    <div className="text-right text-sm space-y-1">
                      <p>パット {calcTotalPutts(detailRound.holes)}</p>
                      {fairwayRate(detailRound.holes) !== null && <p>FW {fairwayRate(detailRound.holes)}%</p>}
                      <p>GIR {girRate(detailRound.holes)}%</p>
                    </div>
                  </div>
                </div>

                {/* 弱点分析 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-bold text-yellow-800 mb-2">📊 弱点分析</p>
                  <ul className="space-y-1">
                    {weaknessAnalysis(detailRound).map((w, i) => (
                      <li key={i} className="text-xs text-yellow-700">・{w}</li>
                    ))}
                  </ul>
                </div>

                {/* ホール別スコア表 */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-2 text-left text-xs text-gray-500">H</th>
                        <th className="py-2 px-2 text-center text-xs text-gray-500">Par</th>
                        <th className="py-2 px-2 text-center text-xs text-gray-500">Score</th>
                        <th className="py-2 px-2 text-center text-xs text-gray-500">Putt</th>
                        <th className="py-2 px-2 text-center text-xs text-gray-500">FW</th>
                        <th className="py-2 px-2 text-center text-xs text-gray-500">GIR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRound.holes.map(h => {
                        const diff = h.score - h.par;
                        return (
                          <tr key={h.hole} className="border-t border-gray-100">
                            <td className="py-2 px-2 text-gray-500">{h.hole}</td>
                            <td className="py-2 px-2 text-center text-gray-600">{h.par}</td>
                            <td className={`py-2 px-2 text-center font-bold ${diff < 0 ? "text-blue-600" : diff === 0 ? "text-gray-800" : diff === 1 ? "text-orange-500" : "text-red-600"}`}>
                              {h.score}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-600">{h.putts}</td>
                            <td className="py-2 px-2 text-center">{h.par === 3 ? "—" : h.fairway ? "○" : "✕"}</td>
                            <td className="py-2 px-2 text-center">{h.gir ? "○" : "✕"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {detailRound.memo && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">メモ</p>
                    <p className="text-sm text-gray-700">{detailRound.memo}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 練習タブ ===== */}
        {tab === "practice" && (
          <div>
            {practiceView === "list" && (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-gray-800">練習記録</h2>
                  <button
                    onClick={startNewPractice}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >＋ 記録する</button>
                </div>

                {/* 練習統計 */}
                {practices.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{practices.length}</p>
                      <p className="text-xs text-gray-500">練習回数</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {Math.floor(totalPracticeMin / 60)}h{totalPracticeMin % 60}m
                      </p>
                      <p className="text-xs text-gray-500">累計練習時間</p>
                    </div>
                  </div>
                )}

                {practices.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">🏌️</p>
                    <p className="text-sm">練習を記録しよう</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {practices.map(p => (
                      <div
                        key={p.id}
                        onClick={() => { setDetailPractice(p); setPracticeView("detail"); }}
                        className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-green-400"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{p.location}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{p.date}</p>
                          </div>
                          <p className="text-sm font-medium text-green-700">{p.duration}分</p>
                        </div>
                        {p.theme && <p className="text-sm text-gray-600 mt-2">{p.theme}</p>}
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {(p.bodyParts ?? []).map(c => (
                            <span key={c} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {BODY_PART_CATEGORIES.find(pc => pc.key === c)?.label}
                            </span>
                          ))}
                          {(p.clubs ?? []).map(c => (
                            <span key={c} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                              {CLUB_CATEGORIES.find(pc => pc.key === c)?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 練習記録フォーム */}
            {practiceView === "new" && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setPracticeView("list")} className="text-gray-500">←</button>
                  <h2 className="font-bold text-gray-800">練習を記録</h2>
                </div>
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">日付</label>
                      <input
                        type="date"
                        value={newPractice.date ?? today()}
                        onChange={e => setNewPractice(p => ({ ...p, date: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">場所</label>
                      <div className="flex gap-2 flex-wrap">
                        {LOCATIONS.map(loc => (
                          <button
                            key={loc}
                            onClick={() => setNewPractice(p => ({ ...p, location: loc }))}
                            className={`px-3 py-1.5 rounded-full text-sm ${newPractice.location === loc ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
                          >{loc}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">練習時間（分）</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={newPractice.duration ?? ""}
                        onChange={e => setNewPractice(p => ({ ...p, duration: Math.max(1, parseInt(e.target.value) || 0) }))}
                        placeholder="60"
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">球数（打ちっぱなしの場合）</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={newPractice.balls ?? ""}
                        onChange={e => setNewPractice(p => ({ ...p, balls: Math.max(0, parseInt(e.target.value) || 0) }))}
                        placeholder="100"
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-2">観点（体の動き）</label>
                      <div className="flex gap-2 flex-wrap">
                        {BODY_PART_CATEGORIES.map(c => (
                          <button
                            key={c.key}
                            onClick={() => toggleBodyPart(c.key)}
                            className={`px-3 py-1.5 rounded-full text-sm ${(newPractice.bodyParts ?? []).includes(c.key) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                          >{c.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-2">クラブ種別</label>
                      <div className="flex gap-2 flex-wrap">
                        {CLUB_CATEGORIES.map(c => (
                          <button
                            key={c.key}
                            onClick={() => toggleClub(c.key)}
                            className={`px-3 py-1.5 rounded-full text-sm ${(newPractice.clubs ?? []).includes(c.key) ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
                          >{c.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">テーマ・課題</label>
                      <input
                        type="text"
                        value={newPractice.theme ?? ""}
                        onChange={e => setNewPractice(p => ({ ...p, theme: e.target.value }))}
                        placeholder="例：右に曲がるドライバーを矯正"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">メモ</label>
                      <textarea
                        value={newPractice.memo ?? ""}
                        onChange={e => setNewPractice(p => ({ ...p, memo: e.target.value }))}
                        placeholder="気づいたこと・試したこと"
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={savePractice}
                    className="w-full bg-green-600 text-white py-3 rounded-xl font-bold"
                  >保存する</button>
                </div>
              </div>
            )}

            {/* 練習詳細 */}
            {practiceView === "detail" && detailPractice && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPracticeView("list")} className="text-gray-500">←</button>
                    <h2 className="font-bold text-gray-800">練習記録</h2>
                  </div>
                  <button onClick={() => deletePractice(detailPractice.id)} className="text-red-400 text-sm">削除</button>
                </div>
                <div className="bg-green-700 text-white rounded-xl p-4 mb-4">
                  <p className="text-sm opacity-80">{detailPractice.date}</p>
                  <p className="text-xl font-bold mt-1">{detailPractice.location}</p>
                  <div className="flex gap-4 mt-2 text-sm opacity-90">
                    <span>⏱ {detailPractice.duration}分</span>
                    {detailPractice.balls > 0 && <span>🏌️ {detailPractice.balls}球</span>}
                  </div>
                </div>
                {((detailPractice.bodyParts ?? []).length > 0 || (detailPractice.clubs ?? []).length > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 space-y-3">
                    {(detailPractice.bodyParts ?? []).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">観点（体の動き）</p>
                        <div className="flex gap-2 flex-wrap">
                          {(detailPractice.bodyParts ?? []).map(c => (
                            <span key={c} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
                              {BODY_PART_CATEGORIES.find(pc => pc.key === c)?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(detailPractice.clubs ?? []).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">クラブ種別</p>
                        <div className="flex gap-2 flex-wrap">
                          {(detailPractice.clubs ?? []).map(c => (
                            <span key={c} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm">
                              {CLUB_CATEGORIES.find(pc => pc.key === c)?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {detailPractice.theme && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
                    <p className="text-xs text-gray-500 mb-1">テーマ・課題</p>
                    <p className="text-sm text-gray-800">{detailPractice.theme}</p>
                  </div>
                )}
                {detailPractice.memo && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">メモ</p>
                    <p className="text-sm text-gray-700">{detailPractice.memo}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 分析タブ ===== */}
        {tab === "analysis" && (
          <div className="p-4">
            <h2 className="font-bold text-gray-800 mb-4">分析・統計</h2>

            {rounds.length === 0 && practices.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm">ラウンドや練習を記録すると<br />ここに統計が表示されます</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ラウンド統計 */}
                {rounds.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{avgScore}</p>
                        <p className="text-xs text-gray-400">平均スコア</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{bestScore}</p>
                        <p className="text-xs text-gray-400">ベストスコア</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{rounds.length}</p>
                        <p className="text-xs text-gray-400">ラウンド数</p>
                      </div>
                    </div>

                    {/* スコア推移 */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">スコア推移（直近5ラウンド）</p>
                      <div className="space-y-2">
                        {recentRounds.map(r => {
                          const total = calcTotal(r.holes);
                          const max = Math.max(...recentRounds.map(rr => calcTotal(rr.holes)));
                          const min = Math.min(...recentRounds.map(rr => calcTotal(rr.holes)));
                          const range = max - min || 1;
                          const width = 30 + ((total - min) / range) * 70;
                          return (
                            <div key={r.id} className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-20 shrink-0">{r.date.slice(5)}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                                <div
                                  className="bg-green-500 h-6 rounded-full flex items-center justify-end pr-2"
                                  style={{ width: `${width}%` }}
                                >
                                  <span className="text-xs text-white font-bold">{total}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 平均スタッツ */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">平均スタッツ</p>
                      <div className="space-y-2">
                        {[
                          { label: "平均パット数", value: (rounds.reduce((s, r) => s + calcTotalPutts(r.holes), 0) / rounds.length).toFixed(1) },
                          { label: "FW安打率", value: (() => { const rates = rounds.map(r => fairwayRate(r.holes)).filter(v => v !== null) as number[]; return rates.length ? Math.round(rates.reduce((s, v) => s + v, 0) / rates.length) + "%" : "—"; })() },
                          { label: "GIR率", value: Math.round(rounds.reduce((s, r) => s + girRate(r.holes), 0) / rounds.length) + "%" },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between">
                            <span className="text-sm text-gray-600">{item.label}</span>
                            <span className="text-sm font-bold text-gray-800">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 練習統計 */}
                {practices.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">練習統計</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">累計練習時間</span>
                        <span className="text-sm font-bold text-gray-800">{Math.floor(totalPracticeMin / 60)}h{totalPracticeMin % 60}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">練習回数</span>
                        <span className="text-sm font-bold text-gray-800">{practices.length}回</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">平均練習時間</span>
                        <span className="text-sm font-bold text-gray-800">{Math.round(totalPracticeMin / practices.length)}分/回</span>
                      </div>
                    </div>
                    {/* クラブ別練習頻度 */}
                    <p className="text-xs text-gray-500 mt-3 mb-2">クラブ別練習回数</p>
                    <div className="space-y-1">
                      {CLUB_CATEGORIES.map(cat => {
                        const count = practices.filter(p => (p.clubs ?? []).includes(cat.key)).length;
                        if (count === 0) return null;
                        return (
                          <div key={cat.key} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 shrink-0">{cat.label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4">
                              <div
                                className="bg-green-400 h-4 rounded-full flex items-center justify-end pr-1"
                                style={{ width: `${(count / practices.length) * 100}%` }}
                              >
                                <span className="text-xs text-white">{count}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 観点別練習頻度 */}
                    <p className="text-xs text-gray-500 mt-3 mb-2">観点別練習回数</p>
                    <div className="space-y-1">
                      {BODY_PART_CATEGORIES.map(cat => {
                        const count = practices.filter(p => (p.bodyParts ?? []).includes(cat.key)).length;
                        if (count === 0) return null;
                        return (
                          <div key={cat.key} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 shrink-0">{cat.label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4">
                              <div
                                className="bg-blue-400 h-4 rounded-full flex items-center justify-end pr-1"
                                style={{ width: `${(count / practices.length) * 100}%` }}
                              >
                                <span className="text-xs text-white">{count}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ボトムナビ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {([
          ["round", "⛳", "ラウンド"],
          ["practice", "🏌️", "練習"],
          ["analysis", "📊", "分析"],
        ] as [Tab, string, string][]).map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab === key ? "text-green-700" : "text-gray-400"}`}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
