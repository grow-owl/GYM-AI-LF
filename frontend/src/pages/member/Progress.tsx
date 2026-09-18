import { useMemo, useRef, useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { Camera, Upload, Clock3, Plus, Scale, Target, Activity, TrendingDown, Trash2, Sparkles, Loader2, Moon, Droplets, Calendar, Edit3 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import BarChart, { type BarDatum } from "@/components/ui/BarChart";
import { progressApi, memberApi, workoutApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import WorkoutConsistencyChart from "@/components/member/WorkoutConsistencyChart";
import { getLocalDateKey } from "@/lib/dateUtils";

interface ProgressPhoto {
  id: string;
  capturedAt: string;
  src: string;
  angle?: string;
  notes?: string;
}

const UPLOAD_GAP_DAYS = 5;

const MOOD_META: Record<string, { label: string; emoji: string; badgeClass: string }> = {
  great: { label: "Great", emoji: "😄", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800" },
  good: { label: "Good", emoji: "🙂", badgeClass: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800" },
  okay: { label: "Okay", emoji: "😐", badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800" },
  tired: { label: "Tired", emoji: "🥱", badgeClass: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800" },
  stressed: { label: "Stressed", emoji: "😫", badgeClass: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800" },
};

function formatWellnessDate(dayKey?: string, createdAt?: string): string {
  if (dayKey) {
    const today = getLocalDateKey();
    if (dayKey === today) return "Today";
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yesterday = getLocalDateKey(yDate);
    if (dayKey === yesterday) return "Yesterday";

    const [y, m, d] = dayKey.split("-").map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    }
  }
  if (createdAt) {
    return new Date(createdAt).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  return "Past Entry";
}

function getPastNDays(n = 7) {
  const days: { dayKey: string; label: string; subLabel: string; isToday: boolean; isYesterday: boolean }[] = [];
  const todayKey = getLocalDateKey();
  
  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yDate);

  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayKey = getLocalDateKey(d);
    const isToday = dayKey === todayKey;
    const isYesterday = dayKey === yesterdayKey;
    
    const label = isToday ? "Today" : isYesterday ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short" });
    const subLabel = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

    days.push({ dayKey, label, subLabel, isToday, isYesterday });
  }
  return days;
}

function calculateQuickRecoveryScore(sleepHours?: number, waterIntakeMl?: number): { score: number; label: string; color: string } {
  if (sleepHours === undefined && waterIntakeMl === undefined) {
    return { score: 0, label: "Not Logged", color: "text-(--color-text-faint) bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700" };
  }
  let score = 50;
  if (sleepHours !== undefined) {
    if (sleepHours >= 7.5) score += 30;
    else if (sleepHours >= 6.5) score += 20;
    else if (sleepHours >= 5.5) score += 10;
    else score -= 15;
  }
  if (waterIntakeMl !== undefined) {
    if (waterIntakeMl >= 2500) score += 20;
    else if (waterIntakeMl >= 1500) score += 10;
    else score -= 10;
  }
  score = Math.max(15, Math.min(100, score));
  if (score >= 85) return { score, label: "Optimal", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" };
  if (score >= 70) return { score, label: "Good", color: "text-teal-700 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800" };
  if (score >= 50) return { score, label: "Moderate", color: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" };
  return { score, label: "Fatigued", color: "text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" };
}

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Client-side Canvas Image Compression
 * Shrinks 8-15MB camera images to ~150-250KB JPEG (1200px max dimension, 0.8 quality)
 */
function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

function WeightLineChart({
  data,
  onLogWeight,
}: {
  data: Array<{ label: string; value: number }>;
  onLogWeight?: () => void;
}) {
  if (data.length === 0) {
    return (
      <div className="w-full h-44 flex flex-col items-center justify-center text-center p-4 bg-(--color-surface-2)/30 rounded-xl border border-dashed border-(--color-border)">
        <Scale className="w-8 h-8 text-(--color-text-faint) mb-2" />
        <p className="text-xs font-semibold text-(--color-text-muted)">No weight entries recorded yet</p>
        <p className="text-[11px] text-(--color-text-faint) mt-0.5 mb-2.5">Click "+ Log Weight" to start tracking your weight journey.</p>
        {onLogWeight && (
          <button
            onClick={onLogWeight}
            className="inline-flex items-center gap-1.5 rounded-xl bg-(--color-accent) text-white text-xs font-semibold px-3.5 py-1.5 hover:opacity-90 transition-all shadow-xs cursor-pointer"
          >
            <Plus size={13} /> Log Weight
          </button>
        )}
      </div>
    );
  }

  const width = 420;
  const height = 170;
  const padX = 24;
  const padY = 20;
  const weights = data.map((d) => d.value);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = Math.max(0.1, max - min);

  const points = data
    .map((d, i) => {
      const x = data.length === 1 ? width / 2 : padX + (i * (width - padX * 2)) / (data.length - 1);
      const y = padY + ((max - d.value) * (height - padY * 2)) / range;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--color-border)" strokeWidth="1" />
        {data.length > 1 && (
          <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {data.map((d, i) => {
          const x = data.length === 1 ? width / 2 : padX + (i * (width - padX * 2)) / (data.length - 1);
          const y = padY + ((max - d.value) * (height - padY * 2)) / range;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
              <text x={x} y={y - 9} fontSize="10" textAnchor="middle" fill="var(--color-text)" fontWeight="bold">
                {d.value} kg
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-(--color-text-faint) overflow-x-auto">
        {data.map((d, idx) => (
          <span key={idx} className="truncate px-1">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function Progress() {
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [weightLogs, setWeightLogs] = useState<Array<{ label: string; value: number; createdAt: string }>>([]);
  const [memberProfile, setMemberProfile] = useState<any | null>(null);
  const [strengthTrend, setStrengthTrend] = useState<BarDatum[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [newWeight, setNewWeight] = useState("70.0");

  const [showWellnessModal, setShowWellnessModal] = useState(false);
  const [editingDayKey, setEditingDayKey] = useState<string>(() => getLocalDateKey());
  const [sleepHours, setSleepHours] = useState("8");
  const [waterLiters, setWaterLiters] = useState("2.5");
  const [mood, setMood] = useState<"great" | "good" | "okay" | "tired" | "stressed">("good");
  const [savingWellness, setSavingWellness] = useState(false);
  const [todayWellness, setTodayWellness] = useState<{
    sleepHours?: number;
    waterIntakeMl?: number;
    mood?: "great" | "good" | "okay" | "tired" | "stressed";
  } | null>(null);
  const [wellnessHistory, setWellnessHistory] = useState<any[]>([]);
  const past7Days = useMemo(() => getPastNDays(7), []);

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProgressData = async () => {
    setLoading(true);
    try {
      const profRes = await memberApi.getSelfProfile().catch(() => null);
      const m = profRes?.member;
      if (m) setMemberProfile(m);

      const memberId = m?._id || user?._id;
      if (memberId) {
        const [wRes, compRes, photoRes, _summaryRes, wellnessRes] = await Promise.all([
          progressApi.getHistory(memberId).catch(() => null),
          workoutApi.getCompletionStats(memberId).catch(() => null),
          progressApi.getPhotos(memberId).catch(() => null),
          progressApi.getSummary().catch(() => null),
          progressApi.getWellnessHistory().catch(() => null),
        ]);

        // Process today's wellness history
        const wList = Array.isArray(wellnessRes) ? wellnessRes : wellnessRes?.history || [];
        setWellnessHistory(wList);
        const dateKey = getLocalDateKey();
        const todayEntry = wList.find((w: any) => w.dayKey === dateKey);
        if (todayEntry) {
          setTodayWellness({
            sleepHours: todayEntry.sleepHours,
            waterIntakeMl: todayEntry.waterIntakeMl,
            mood: todayEntry.mood,
          });
          if (todayEntry.sleepHours !== undefined) {
            setSleepHours(String(todayEntry.sleepHours));
          }
          if (todayEntry.waterIntakeMl !== undefined) {
            setWaterLiters((todayEntry.waterIntakeMl / 1000).toFixed(1));
          }
          if (todayEntry.mood) {
            setMood(todayEntry.mood);
          }
        } else {
          // Brand new day: No wellness logged yet for today! Reset cleanly!
          setTodayWellness(null);
          setSleepHours("8");
          setWaterLiters("0");
          setMood("good");
          localStorage.setItem("gymai_water_glasses", "0");
          localStorage.setItem("gymai_water_glasses_date", dateKey);
          localStorage.setItem("gymai_water_liters", "0.00");
        }

        const rawPhotos = Array.isArray(photoRes)
          ? photoRes
          : Array.isArray(photoRes?.photos)
          ? photoRes.photos
          : [];

        if (rawPhotos.length > 0) {
          const remotePhotos: ProgressPhoto[] = rawPhotos.map((p: any) => ({
            id: p._id || p.id,
            capturedAt: p.recordedAt || p.createdAt || p.capturedAt || new Date().toISOString(),
            src: p.imageUrl || p.photoUrl || p.src,
            angle: p.angle || "front",
            notes: p.notes,
          }));
          remotePhotos.sort(
            (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
          );
          setPhotos(remotePhotos);
        } else {
          setPhotos([]);
        }

        if (wRes) {
          const rawList = Array.isArray(wRes) ? wRes : wRes?.history || wRes?.logs || [];
          const sorted = [...rawList].sort(
            (a, b) => new Date(a.createdAt || a.recordedAt).getTime() - new Date(b.createdAt || b.recordedAt).getTime()
          );
          const mapped = sorted.map((item, idx) => ({
            label: new Date(item.createdAt || item.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) || `Log ${idx + 1}`,
            value: Number(item.weightKg),
            createdAt: item.createdAt || item.recordedAt,
          }));
          setWeightLogs(mapped);
          if (mapped.length > 0) {
            setNewWeight(String(mapped[mapped.length - 1].value));
          }
        }

        const statsData = compRes?.stats || compRes;
        if (statsData?.weeklyVolumeLogs && Array.isArray(statsData.weeklyVolumeLogs)) {
          const bars: BarDatum[] = statsData.weeklyVolumeLogs.map((log: any) => ({
            label: log.day || "Day",
            value: log.volume || 0,
            color: "var(--color-accent)",
          }));
          setStrengthTrend(bars);
        }
      }
    } catch (err) {
      console.error("Error loading progress data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgressData();

    const handleWellnessEvent = (e: any) => {
      if (e?.detail) {
        const eventDayKey = e.detail.dayKey || getLocalDateKey();
        const isToday = eventDayKey === getLocalDateKey();

        if (isToday) {
          setTodayWellness((prev) => ({
            ...prev,
            waterIntakeMl: e.detail.waterMl ?? prev?.waterIntakeMl,
            sleepHours: e.detail.sleepHours ?? prev?.sleepHours,
            mood: e.detail.mood ?? prev?.mood,
          }));
          if (e.detail.waterMl !== undefined) {
            setWaterLiters((e.detail.waterMl / 1000).toFixed(1));
          }
        }

        setWellnessHistory((prev) => {
          const filtered = prev.filter((item) => item.dayKey !== eventDayKey);
          const existing = prev.find((item) => item.dayKey === eventDayKey);
          return [
            {
              dayKey: eventDayKey,
              sleepHours: e.detail.sleepHours ?? existing?.sleepHours,
              waterIntakeMl: e.detail.waterMl ?? existing?.waterIntakeMl,
              mood: e.detail.mood ?? existing?.mood,
              createdAt: existing?.createdAt || new Date().toISOString(),
            },
            ...filtered,
          ];
        });
      } else {
        loadProgressData();
      }
    };

    window.addEventListener("gymai:wellness-updated", handleWellnessEvent);
    return () => {
      window.removeEventListener("gymai:wellness-updated", handleWellnessEvent);
    };
  }, []);

  const latestPhoto = photos[0];
  const today = new Date();
  const daysSinceLatest = latestPhoto ? daysBetween(today, new Date(latestPhoto.capturedAt)) : UPLOAD_GAP_DAYS;
  const canUploadNow = daysSinceLatest >= UPLOAD_GAP_DAYS;
  const remainingDays = Math.max(0, UPLOAD_GAP_DAYS - daysSinceLatest);

  // Before & After visual comparison calculation
  const sortedAscending = useMemo(() => {
    return [...photos].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
  }, [photos]);

  const baselinePhoto = sortedAscending.length >= 2 ? sortedAscending[0] : null;
  const currentPhoto = sortedAscending.length >= 2 ? sortedAscending[sortedAscending.length - 1] : null;
  const daysTransformed =
    baselinePhoto && currentPhoto
      ? daysBetween(new Date(currentPhoto.capturedAt), new Date(baselinePhoto.capturedAt))
      : 0;

  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].value : null;
  const initialWeight = weightLogs.length > 0 ? weightLogs[0].value : null;
  const totalChange = latestWeight !== null && initialWeight !== null ? (latestWeight - initialWeight).toFixed(1) : null;
  const targetWeight = memberProfile?.healthInfo?.targetWeight_kg || memberProfile?.targetWeightKg || null;

  const avgWeight = useMemo(() => {
    if (weightLogs.length === 0) return "--";
    const total = weightLogs.reduce((sum, point) => sum + point.value, 0);
    return (total / weightLogs.length).toFixed(1);
  }, [weightLogs]);

  const handleSaveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) return;
    try {
      await progressApi.logWeight(w, "Daily weigh-in");
      toast.success(`Weight ${w} kg saved successfully!`);
      setShowLogModal(false);
      loadProgressData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to log weight. Please try again.");
    }
  };

  const openWellnessModal = (dayKeyToEdit?: string) => {
    const targetKey = dayKeyToEdit || getLocalDateKey();
    setEditingDayKey(targetKey);
    const existing = wellnessHistory.find((w: any) => w.dayKey === targetKey);
    if (existing) {
      setSleepHours(existing.sleepHours !== undefined ? String(existing.sleepHours) : "8");
      setWaterLiters(existing.waterIntakeMl !== undefined ? (existing.waterIntakeMl / 1000).toFixed(1) : "2.5");
      setMood(existing.mood || "good");
    } else if (targetKey === getLocalDateKey() && todayWellness) {
      setSleepHours(todayWellness.sleepHours !== undefined ? String(todayWellness.sleepHours) : "8");
      setWaterLiters(todayWellness.waterIntakeMl !== undefined ? (todayWellness.waterIntakeMl / 1000).toFixed(1) : "2.5");
      setMood(todayWellness.mood || "good");
    } else {
      setSleepHours("8");
      setWaterLiters("2.5");
      setMood("good");
    }
    setShowWellnessModal(true);
  };

  const handleSaveWellness = async (e: React.FormEvent) => {
    e.preventDefault();
    const sleep = parseFloat(sleepHours);
    const water = parseFloat(waterLiters);
    if (isNaN(sleep) || sleep < 0 || sleep > 24) {
      toast.error("Please enter a valid sleep duration (0-24 hours)");
      return;
    }

    setSavingWellness(true);
    const targetKey = editingDayKey || getLocalDateKey();
    const isToday = targetKey === getLocalDateKey();

    try {
      const waterMl = !isNaN(water) && water >= 0 ? Math.round(water * 1000) : undefined;
      await progressApi.logWellness({
        sleepHours: sleep,
        waterIntakeMl: waterMl,
        mood,
        dayKey: targetKey,
      });

      if (isToday) {
        if (waterMl !== undefined) {
          const glasses = Math.min(12, Math.round(waterMl / 375));
          localStorage.setItem("gymai_water_glasses", String(glasses));
          localStorage.setItem("gymai_water_glasses_date", targetKey);
          localStorage.setItem("gymai_water_liters", (waterMl / 1000).toFixed(2));
        }

        setTodayWellness({
          sleepHours: sleep,
          waterIntakeMl: waterMl,
          mood,
        });
      }

      setWellnessHistory((prev) => {
        const filtered = prev.filter((item) => item.dayKey !== targetKey);
        const existing = prev.find((item) => item.dayKey === targetKey);
        return [
          {
            dayKey: targetKey,
            sleepHours: sleep,
            waterIntakeMl: waterMl,
            mood,
            createdAt: existing?.createdAt || new Date().toISOString(),
          },
          ...filtered,
        ];
      });

      const dayTitle = isToday ? "Today's" : formatWellnessDate(targetKey);
      toast.success(`${dayTitle} wellness saved! (${sleep}h sleep, ${(waterMl ? waterMl / 1000 : 0).toFixed(1)}L water)`);
      setShowWellnessModal(false);

      window.dispatchEvent(
        new CustomEvent("gymai:wellness-updated", {
          detail: {
            waterGlasses: waterMl ? Math.min(12, Math.round(waterMl / 375)) : 0,
            waterMl,
            sleepHours: sleep,
            mood,
            dayKey: targetKey,
          },
        })
      );
      window.dispatchEvent(new Event("gymai:workout-updated"));
      loadProgressData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to log wellness.");
    } finally {
      setSavingWellness(false);
    }
  };

  function handlePickPhoto() {
    if (!canUploadNow || uploading) return;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Compressing & uploading photo to Cloudinary...");
    try {
      const compressedBase64 = await compressImage(file, 1200, 0.8);
      await progressApi.uploadPhoto({
        image: compressedBase64,
        angle: "front",
        notes: "Member Progress Check-in",
      });
      toast.success("Progress photo uploaded & synced!", { id: toastId });
      await loadProgressData();
    } catch (err: any) {
      console.error("Progress photo upload error:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to upload photo. Please try again.",
        { id: toastId }
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (
      !window.confirm(
        "Are you sure you want to delete this progress photo? It will be permanently removed from Cloudinary and your timeline."
      )
    ) {
      return;
    }

    setDeletingId(photoId);
    try {
      await progressApi.deletePhoto(photoId);
      toast.success("Progress photo deleted successfully!");
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err: any) {
      console.error("Photo delete error:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to delete progress photo."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Progress Report"
        subtitle="Track weight changes, strength progression & body transformation timeline"
        subtitleClassName="hidden lg:block"
        backTo="/member"
      />

      {/* Dynamic Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-(--color-surface) border border-(--color-border)">
          <div className="flex items-center gap-2 mb-1 text-(--color-accent)">
            <Scale size={16} />
            <p className="text-xs font-semibold text-(--color-text-muted)">Current Weight</p>
          </div>
          <p className="font-display text-xl font-bold text-(--color-text)">
            {latestWeight !== null ? `${latestWeight} kg` : "--"}
          </p>
          <p className="text-[11px] text-(--color-text-faint) mt-1">
            {weightLogs.length > 0 ? `${weightLogs.length} logs recorded` : "No weigh-ins yet"}
          </p>
        </Card>

        <Card className="p-4 bg-(--color-surface) border border-(--color-border)">
          <div className="flex items-center gap-2 mb-1 text-emerald-400">
            <TrendingDown size={16} />
            <p className="text-xs font-semibold text-(--color-text-muted)">Total Weight Change</p>
          </div>
          <p className="font-display text-xl font-bold text-(--color-text)">
            {totalChange !== null ? `${Number(totalChange) > 0 ? `+${totalChange}` : totalChange} kg` : "--"}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">
            {totalChange !== null ? "Since first logged weigh-in" : "Log weight to calculate"}
          </p>
        </Card>

        <Card className="p-4 bg-(--color-surface) border border-(--color-border)">
          <div className="flex items-center gap-2 mb-1 text-indigo-400">
            <Target size={16} />
            <p className="text-xs font-semibold text-(--color-text-muted)">Target Weight</p>
          </div>
          <p className="font-display text-xl font-bold text-(--color-text)">
            {targetWeight ? `${targetWeight} kg` : "--"}
          </p>
          <p className="text-[11px] text-(--color-text-faint) mt-1">
            {targetWeight && latestWeight ? `${(latestWeight - targetWeight).toFixed(1)} kg remaining` : "Set target in profile"}
          </p>
        </Card>

        <Card className="p-4 bg-(--color-surface) border border-(--color-border)">
          <div className="flex items-center gap-2 mb-1 text-amber-400">
            <Activity size={16} />
            <p className="text-xs font-semibold text-(--color-text-muted)">Average Weight</p>
          </div>
          <p className="font-display text-xl font-bold text-(--color-text)">
            {avgWeight !== "--" ? `${avgWeight} kg` : "--"}
          </p>
          <p className="text-[11px] text-(--color-text-faint) mt-1">Overall average weight</p>
        </Card>
      </div>

      {/* Today's Live Wellness & Hydration Tracker Bar */}
      <div className="bg-white dark:bg-(--color-surface) p-4 sm:p-5 rounded-2xl border border-(--color-border) shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Droplets size={22} className="fill-sky-500/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-(--color-text)">Today's Wellness & Recovery</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs mt-1.5 text-(--color-text-muted)">
              <span className="flex items-center gap-1.5">
                <Droplets size={14} className="text-sky-500" />
                <strong className="text-(--color-text) font-bold">
                  {todayWellness?.waterIntakeMl !== undefined
                    ? `${(todayWellness.waterIntakeMl / 1000).toFixed(2)}L`
                    : "0.00L"}
                </strong>
                <span className="text-[11px] text-(--color-text-faint)">
                  / 3.0L Hydration (
                  {todayWellness?.waterIntakeMl !== undefined
                    ? Math.round(todayWellness.waterIntakeMl / 375)
                    : 0}{" "}
                  glasses)
                </span>
              </span>
              <span className="text-(--color-border)">•</span>
              <span className="flex items-center gap-1.5">
                <Moon size={14} className="text-indigo-500" />
                <strong className="text-(--color-text) font-bold">
                  {todayWellness?.sleepHours !== undefined ? `${todayWellness.sleepHours}h` : "--"}
                </strong>
                <span className="text-[11px] text-(--color-text-faint)">/ 8h Sleep Target</span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => openWellnessModal(getLocalDateKey())}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-(--color-surface-2) hover:bg-(--color-surface-3) border border-(--color-border) text-xs font-bold text-(--color-text) hover:text-(--color-accent-text) transition-all cursor-pointer shadow-2xs shrink-0 text-center"
        >
          {todayWellness?.sleepHours !== undefined || todayWellness?.waterIntakeMl !== undefined ? "✏️ Update Today's Wellness" : "+ Log Today's Wellness"}
        </button>
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-xs font-semibold tracking-wide text-(--color-text-faint) uppercase">Weight Trend History</p>
            <button
              onClick={() => setShowLogModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-(--color-accent) text-white text-xs font-bold px-3 py-1.5 hover:opacity-90 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Plus size={14} /> Log Weight
            </button>
          </div>
          <WeightLineChart data={weightLogs} onLogWeight={() => setShowLogModal(true)} />
          {weightLogs.length > 0 && (
            <p className="text-xs text-(--color-text-muted) mt-3">
              Average weight: <span className="font-semibold text-(--color-text)">{avgWeight} kg</span>
            </p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-(--color-text-faint) uppercase mb-3">Weekly Volume Progression</p>
          {strengthTrend.length > 0 ? (
            <BarChart data={strengthTrend} height={180} />
          ) : (
            <div className="w-full h-44 flex flex-col items-center justify-center text-center p-4 bg-(--color-surface-2)/30 rounded-xl border border-dashed border-(--color-border)">
              <Activity className="w-8 h-8 text-(--color-text-faint) mb-2" />
              <p className="text-xs font-semibold text-(--color-text-muted)">No Strength Logs Yet</p>
              <p className="text-[11px] text-(--color-text-faint) mt-0.5">Complete and log workout sessions to see your strength gains.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Workout Completion & Consistency Chart */}
      <Card className="p-5">
        <WorkoutConsistencyChart memberId={user?._id} />
      </Card>

      {/* 7-Day Sleep, Hydration & Wellness Comparison Tracker */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Moon size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-sm sm:text-base font-bold text-(--color-text)">
                  Weekly Sleep & Recovery Tracker
                </h3>
              </div>
              <p className="hidden lg:block text-xs text-(--color-text-muted) mt-0.5">
                Track your daily rest, water intake, and readiness day by day
              </p>
            </div>
          </div>

          {/* Log button placed cleanly below on mobile and tablet, aligned right on desktop */}
          <button
            onClick={() => openWellnessModal(getLocalDateKey())}
            className="w-full lg:w-auto py-2 sm:py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            <span>Log Wellness</span>
          </button>
        </div>

        {/* 7-Day Day-by-Day Comparison Cards Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-6">
          {past7Days.map((day) => {
            const entry = wellnessHistory.find((w: any) => w.dayKey === day.dayKey);
            const hasData = !!entry && (entry.sleepHours !== undefined || entry.waterIntakeMl !== undefined);
            const moodMeta = entry?.mood ? MOOD_META[entry.mood] : null;
            const recovery = calculateQuickRecoveryScore(entry?.sleepHours, entry?.waterIntakeMl);

            return (
              <div
                key={day.dayKey}
                onClick={() => openWellnessModal(day.dayKey)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                  day.isToday
                    ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 shadow-xs ring-2 ring-indigo-500/20"
                    : day.isYesterday
                    ? "bg-(--color-surface-2)/60 border-(--color-border) hover:border-indigo-300"
                    : "bg-(--color-surface) border-(--color-border) hover:border-(--color-border-strong)"
                }`}
              >
                {/* Header: Day & Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                      day.isToday ? "text-indigo-600 dark:text-indigo-400" : day.isYesterday ? "text-(--color-text)" : "text-(--color-text-muted)"
                    }`}>
                      {day.label}
                    </span>
                    {day.isToday && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Active Day" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-(--color-text-faint)">{day.subLabel}</p>
                </div>

                {/* Metrics */}
                <div className="my-2.5 space-y-1.5">
                  {/* Sleep */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-(--color-text-muted)">
                      <Moon size={11} className="text-indigo-500" />
                      <span className="text-[10px]">Sleep</span>
                    </span>
                    <span className="font-mono font-bold text-(--color-text) text-[11px]">
                      {entry?.sleepHours !== undefined ? `${entry.sleepHours}h` : "--"}
                    </span>
                  </div>

                  {/* Water */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-(--color-text-muted)">
                      <Droplets size={11} className="text-sky-500" />
                      <span className="text-[10px]">Water</span>
                    </span>
                    <span className="font-mono font-bold text-(--color-text) text-[11px]">
                      {entry?.waterIntakeMl !== undefined ? `${(entry.waterIntakeMl / 1000).toFixed(1)}L` : "--"}
                    </span>
                  </div>

                  {/* Mood */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-[10px] text-(--color-text-muted)">Mood</span>
                    <span className="text-xs" title={moodMeta?.label || "Not logged"}>
                      {moodMeta ? moodMeta.emoji : "--"}
                    </span>
                  </div>
                </div>

                {/* Bottom Status / Action */}
                <div className="pt-1.5 border-t border-(--color-border)/60 flex items-center justify-between">
                  {hasData ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${recovery.color}`}>
                      {recovery.label}
                    </span>
                  ) : (
                    <span className="text-[9px] text-(--color-text-faint) font-medium">
                      No log
                    </span>
                  )}
                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    {hasData ? "Edit" : "+ Log"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed 7-Day & Historical Table */}
        <div className="border-t border-(--color-border) pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-(--color-text-muted) whitespace-nowrap">
              Complete Daily Log History
            </h4>
            <span className="hidden lg:inline text-[11px] text-(--color-text-faint)">
              Showing recent logs ({wellnessHistory.length} recorded)
            </span>
          </div>

          {wellnessHistory.length === 0 ? (
            <div className="w-full py-8 flex flex-col items-center justify-center text-center p-4 bg-(--color-surface-2)/30 rounded-xl border border-dashed border-(--color-border)">
              <Moon className="w-8 h-8 text-(--color-text-faint) mb-2" />
              <p className="text-xs font-semibold text-(--color-text-muted)">No sleep & wellness history recorded yet</p>
              <p className="text-[11px] text-(--color-text-faint) mt-0.5">
                Click "+ Log Wellness" above to record your sleep, water, and mood.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Clean Card List (< md) */}
              <div className="md:hidden space-y-2.5">
                {wellnessHistory.slice(0, 14).map((entry, idx) => {
                  const moodInfo = entry.mood ? MOOD_META[entry.mood] || { label: entry.mood, emoji: "✨", badgeClass: "bg-gray-100 text-gray-700 border-gray-300" } : null;
                  const sleepVal = typeof entry.sleepHours === "number" ? entry.sleepHours : undefined;
                  const recScore = calculateQuickRecoveryScore(entry.sleepHours, entry.waterIntakeMl);

                  return (
                    <div
                      key={entry._id || entry.dayKey || idx}
                      className="p-3.5 rounded-2xl bg-(--color-surface-2)/40 dark:bg-(--color-surface-2)/60 border border-(--color-border) shadow-2xs space-y-2.5"
                    >
                      {/* Header: Date + Recovery Badge + Edit Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar size={13} className="text-indigo-500 shrink-0" />
                          <span className="font-bold text-xs text-(--color-text)">
                            {formatWellnessDate(entry.dayKey, entry.createdAt)}
                          </span>
                          <span className="text-[10px] font-mono text-(--color-text-faint)">
                            ({entry.dayKey})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${recScore.color}`}>
                            {recScore.label}
                          </span>
                          <button
                            onClick={() => openWellnessModal(entry.dayKey)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
                          >
                            <Edit3 size={11} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Sleep */}
                        <div className="p-2.5 rounded-xl bg-white dark:bg-(--color-surface) border border-(--color-border)/80 shadow-2xs">
                          <div className="flex items-center gap-1 text-(--color-text-muted) mb-1">
                            <Moon size={12} className="text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Sleep</span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono font-bold text-xs text-(--color-text)">
                              {sleepVal !== undefined ? `${sleepVal} hrs` : "--"}
                            </span>
                            {sleepVal !== undefined && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                {sleepVal >= 7.5 ? "Optimal" : sleepVal >= 6.5 ? "Adequate" : "Deficit"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hydration */}
                        <div className="p-2.5 rounded-xl bg-white dark:bg-(--color-surface) border border-(--color-border)/80 shadow-2xs">
                          <div className="flex items-center gap-1 text-(--color-text-muted) mb-1">
                            <Droplets size={12} className="text-sky-500 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Hydration</span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono font-bold text-xs text-(--color-text)">
                              {entry.waterIntakeMl !== undefined ? `${(entry.waterIntakeMl / 1000).toFixed(2)}L` : "--"}
                            </span>
                            {entry.waterIntakeMl !== undefined && (
                              <span className="text-[9px] text-(--color-text-faint)">
                                ({Math.round(entry.waterIntakeMl / 375)} gl.)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Energy & Mood Row (if logged) */}
                      {moodInfo && (
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-(--color-border)/60">
                          <span className="text-[10px] text-(--color-text-faint) font-medium">Energy & Mood</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${moodInfo.badgeClass}`}>
                            <span>{moodInfo.emoji}</span>
                            <span>{moodInfo.label}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet View: Table (md:block) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-(--color-border)">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-(--color-surface-2)/60 border-b border-(--color-border) text-(--color-text-muted) font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Sleep Duration</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Hydration</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Energy & Mood</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Recovery Status</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border-soft)">
                    {wellnessHistory.slice(0, 14).map((entry, idx) => {
                      const moodInfo = entry.mood ? MOOD_META[entry.mood] || { label: entry.mood, emoji: "✨", badgeClass: "bg-gray-100 text-gray-700 border-gray-300" } : null;
                      const sleepVal = typeof entry.sleepHours === "number" ? entry.sleepHours : undefined;
                      const recScore = calculateQuickRecoveryScore(entry.sleepHours, entry.waterIntakeMl);

                      return (
                        <tr key={entry._id || entry.dayKey || idx} className="hover:bg-(--color-surface-2)/50 transition-colors">
                          <td className="py-3 px-3 font-semibold text-(--color-text) whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-(--color-text-faint) shrink-0" />
                              <span>{formatWellnessDate(entry.dayKey, entry.createdAt)}</span>
                              <span className="text-[10px] font-mono text-(--color-text-faint)">({entry.dayKey})</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-(--color-text) text-xs">
                                {sleepVal !== undefined ? `${sleepVal} hrs` : "--"}
                              </span>
                              {sleepVal !== undefined && (
                                sleepVal >= 7.5 ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    Optimal (8h)
                                  </span>
                                ) : sleepVal >= 6.5 ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                    Adequate
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    Sleep Deficit
                                  </span>
                                )
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-(--color-text-muted)">
                              <Droplets size={13} className="text-sky-500 shrink-0" />
                              <span className="font-mono font-bold text-(--color-text)">
                                {entry.waterIntakeMl !== undefined ? `${(entry.waterIntakeMl / 1000).toFixed(2)}L` : "--"}
                              </span>
                              {entry.waterIntakeMl !== undefined && (
                                <span className="text-[10px] text-(--color-text-faint)">
                                  ({Math.round(entry.waterIntakeMl / 375)} glasses)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {moodInfo ? (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${moodInfo.badgeClass}`}>
                                <span>{moodInfo.emoji}</span>
                                <span>{moodInfo.label}</span>
                              </span>
                            ) : (
                              <span className="text-(--color-text-faint)">--</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${recScore.color}`}>
                              {recScore.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => openWellnessModal(entry.dayKey)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer flex items-center gap-1 ml-auto"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Transformation Highlight: Before vs After */}
      {baselinePhoto && currentPhoto && (
        <Card className="p-5 border border-amber-500/30 bg-linear-to-r from-amber-500/5 via-transparent to-orange-500/5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
                <Sparkles size={16} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-(--color-text)">Transformation Highlight</h3>
                <p className="text-xs text-(--color-text-muted)">
                  Visual comparison from your initial Day 1 baseline to your latest check-in
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-500 border border-amber-500/30">
              🔥 {daysTransformed} Days of Progress
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Baseline / Day 1 */}
            <div className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface-2)">
              <div className="absolute top-3 left-3 z-10 rounded-full bg-black/75 px-3 py-1 text-[11px] font-bold text-white shadow backdrop-blur-xs">
                BEFORE (Baseline)
              </div>
              <div className="absolute bottom-3 left-3 z-10 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] text-zinc-300 backdrop-blur-xs">
                {formatShortDate(baselinePhoto.capturedAt)}
              </div>
              <img
                src={baselinePhoto.src}
                alt="Baseline Transformation"
                className="h-64 sm:h-72 w-full object-cover"
              />
            </div>

            {/* Current / Latest */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-(--color-surface-2) ring-1 ring-amber-500/20">
              <div className="absolute top-3 left-3 z-10 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-zinc-950 shadow">
                AFTER (Latest)
              </div>
              <div className="absolute bottom-3 left-3 z-10 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] text-zinc-300 backdrop-blur-xs">
                {formatShortDate(currentPhoto.capturedAt)}
              </div>
              <img
                src={currentPhoto.src}
                alt="Latest Transformation"
                className="h-64 sm:h-72 w-full object-cover"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Progress Photos Section */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-(--color-text-faint) uppercase">
              Progress Photo Timeline {photos.length > 0 && `(${photos.length} Total)`}
            </p>
            <p className="text-xs text-(--color-text-muted) mt-1">
              Upload body transformation photos every {UPLOAD_GAP_DAYS} days to visually compare muscle gains and physical changes.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePickPhoto}
            disabled={!canUploadNow || uploading}
            className="w-full sm:w-auto rounded-xl sm:rounded-full bg-(--color-accent) text-white text-xs sm:text-sm font-bold px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md hover:opacity-90 transition-all shrink-0 cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Camera size={14} /> Upload Photo
              </>
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {!canUploadNow && (
          <div className="mb-4 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2 text-xs text-(--color-text-muted) flex items-center gap-1.5">
            <Clock3 size={13} className="text-amber-400" /> Next photo upload available in {remainingDays} day{remainingDays === 1 ? "" : "s"}.
          </div>
        )}

        {photos.length === 0 ? (
          <div
            onClick={canUploadNow && !uploading ? handlePickPhoto : undefined}
            className={`rounded-2xl border border-dashed border-(--color-border) bg-(--color-surface-2)/50 p-8 text-center transition-all ${
              canUploadNow && !uploading ? "cursor-pointer hover:border-(--color-accent)/60 hover:bg-(--color-surface-2)/80" : ""
            }`}
          >
            <Upload size={24} className="mx-auto text-(--color-text-faint)" />
            <p className="mt-2 text-sm font-semibold text-(--color-text)">No Progress Photos Uploaded Yet</p>
            <p className="text-xs text-(--color-text-muted) mt-0.5">Tap "Upload Photo" or click here to capture your physique picture.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface-2)"
              >
                <img
                  src={photo.src}
                  alt={`Progress ${index + 1}`}
                  className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute left-2 bottom-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] text-white font-semibold backdrop-blur-xs">
                  {formatShortDate(photo.capturedAt)}
                </div>
                {photo.angle && (
                  <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-amber-300 uppercase tracking-wider backdrop-blur-xs">
                    {photo.angle}
                  </div>
                )}
                <button
                  type="button"
                  title="Delete progress photo"
                  disabled={deletingId === photo.id}
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-red-400 opacity-90 sm:opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                >
                  {deletingId === photo.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Log Weight Modal */}
      {showLogModal && (
        <Modal onClose={() => setShowLogModal(false)} maxWidth="md" title="Log Weight Entry">
          <form onSubmit={handleSaveWeight} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-(--color-text-muted) block mb-1">Body Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="w-full p-3 rounded-2xl bg-(--color-surface-2) border border-(--color-border) text-base font-bold text-(--color-text) outline-none focus:border-(--color-accent) font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-(--color-text-muted) hover:bg-(--color-surface-2)"
              >
                Cancel
              </button>
              <button type="submit" className="px-6 py-2.5 rounded-full text-xs font-bold bg-(--color-accent) text-white shadow-md">
                Save Weight
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Sleep & Wellness Modal */}
      {showWellnessModal && (
        <Modal
          onClose={() => setShowWellnessModal(false)}
          maxWidth="md"
          title={
            editingDayKey === getLocalDateKey()
              ? "Log Today's Sleep & Wellness"
              : `Log Wellness for ${formatWellnessDate(editingDayKey)} (${editingDayKey})`
          }
        >
          <form onSubmit={handleSaveWellness} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-(--color-text) flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sleep Duration (Hours)</span>
                </label>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {sleepHours} hrs
                </span>
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                required
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="w-full p-3 rounded-2xl bg-(--color-surface-2) border border-(--color-border) text-base font-bold text-(--color-text) outline-none focus:border-indigo-500 font-mono"
              />
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                {["6", "6.5", "7", "7.5", "8", "8.5", "9"].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSleepHours(h)}
                    className={`px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                      sleepHours === h
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                        : "bg-(--color-surface) text-(--color-text-muted) border-(--color-border) hover:border-indigo-400"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-(--color-text) flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Today's Water Intake (Liters)</span>
                </label>
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  {waterLiters} L
                </span>
              </div>
              <input
                type="number"
                step="0.25"
                min="0"
                max="10"
                value={waterLiters}
                onChange={(e) => setWaterLiters(e.target.value)}
                className="w-full p-3 rounded-2xl bg-(--color-surface-2) border border-(--color-border) text-base font-bold text-(--color-text) outline-none focus:border-cyan-500 font-mono"
              />
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                {["1.5", "2.0", "2.5", "3.0", "3.5", "4.0"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setWaterLiters(l)}
                    className={`px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                      waterLiters === l
                        ? "bg-cyan-600 text-white border-cyan-600 font-bold"
                        : "bg-(--color-surface) text-(--color-text-muted) border-(--color-border) hover:border-cyan-400"
                    }`}
                  >
                    {l}L
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-(--color-text) block mb-1.5">
                Energy & Readiness Mood
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { key: "great", label: "Great", emoji: "😃" },
                    { key: "good", label: "Good", emoji: "🙂" },
                    { key: "okay", label: "Okay", emoji: "😐" },
                    { key: "tired", label: "Tired", emoji: "🥱" },
                    { key: "stressed", label: "Stressed", emoji: "😫" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMood(m.key)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      mood === m.key
                        ? "bg-amber-500/15 border-amber-500 text-(--color-text) font-bold scale-102"
                        : "bg-(--color-surface) border-(--color-border) text-(--color-text-muted) hover:border-amber-400/50"
                    }`}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span className="text-[10px] capitalize">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWellnessModal(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-(--color-text-muted) hover:bg-(--color-surface-2) cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingWellness}
                className="px-5 py-2 rounded-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {savingWellness && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Wellness</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

