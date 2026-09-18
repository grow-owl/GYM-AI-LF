export interface ClientProgressExportData {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  planTitle?: string;
  membershipPlan?: string;
  currentWeight?: number | null;
  initialWeight?: number | null;
  targetWeight?: number | null;
  heightCm?: number | null;
  bmiScore?: number | null;
  bmiCategory?: string;
  completionRatePercent?: number;
  totalWorkoutSessions?: number;
  weightHistory?: Array<{ date: string; weightKg: number; heightCm?: number; notes?: string }>;
  exerciseStats?: Array<{ name: string; maxWeightKg: number; volume?: number; initialWeightKg?: number }>;
  workoutLogs?: Array<{ date: string; title: string; exercisesCount?: number; durationMinutes?: number }>;
  trainerName?: string;
  gymName?: string;
}

/**
 * Export structured CSV file for client progress
 */
export function exportClientProgressCsv(data: ClientProgressExportData) {
  const lines: string[] = [];

  // Header & Client Info
  lines.push(`"GYM SAAS - CLIENT COMPREHENSIVE PROGRESS REPORT"`);
  lines.push(`"Generated Date","${new Date().toLocaleString()}"`);
  lines.push(`"Trainer","${data.trainerName || "Assigned Trainer"}"`);
  lines.push(`"Gym / Facility","${data.gymName || "Fitness Center"}"`);
  lines.push("");

  lines.push(`"CLIENT PROFILE"`);
  lines.push(`"Client Name","${data.clientName}"`);
  lines.push(`"Phone / Contact","${data.clientPhone || "N/A"}"`);
  lines.push(`"Membership Plan","${data.membershipPlan || "Active Member"}"`);
  lines.push(`"Active Routine","${data.planTitle || "General Workout Routine"}"`);
  lines.push("");

  // Summary Metrics
  lines.push(`"BODY METRICS & BMI SUMMARY"`);
  lines.push(`"Starting Weight (kg)","${data.initialWeight ?? "N/A"}"`);
  lines.push(`"Current Weight (kg)","${data.currentWeight ?? "N/A"}"`);
  lines.push(`"Target Goal (kg)","${data.targetWeight ?? "N/A"}"`);
  lines.push(`"Height (cm)","${data.heightCm ?? "N/A"}"`);
  lines.push(`"Calculated BMI Score","${data.bmiScore ?? "N/A"}"`);
  lines.push(`"BMI Classification","${data.bmiCategory || "Normal"}"`);
  lines.push(`"Workout Completion Rate","${data.completionRatePercent ?? 0}%"`);
  lines.push(`"Total Workout Sessions Logged","${data.totalWorkoutSessions ?? 0}"`);
  lines.push("");

  // Weight History Table
  lines.push(`"WEIGHT & BODY COMPOSITION LOGS"`);
  lines.push(`"Date","Weight (kg)","Height (cm)","Calculated BMI"`);
  if (data.weightHistory && data.weightHistory.length > 0) {
    data.weightHistory.forEach((log) => {
      const h = log.heightCm || data.heightCm;
      let logBmi = "—";
      if (h && log.weightKg) {
        logBmi = (log.weightKg / Math.pow(h / 100, 2)).toFixed(1);
      }
      lines.push(`"${log.date}","${log.weightKg}","${h || "—"}","${logBmi}"`);
    });
  } else {
    lines.push(`"No weight logs recorded","—","—","—"`);
  }
  lines.push("");

  // Strength & PR Growth
  lines.push(`"STRENGTH & PERSONAL RECORDS (PR) GROWTH"`);
  lines.push(`"Exercise Name","Initial Max (kg)","Current Max / PR (kg)","Growth (kg)","Total Volume Lifted (kg)"`);
  if (data.exerciseStats && data.exerciseStats.length > 0) {
    data.exerciseStats.forEach((ex) => {
      const init = ex.initialWeightKg || ex.maxWeightKg;
      const growth = Number((ex.maxWeightKg - init).toFixed(1));
      lines.push(`"${ex.name}","${init}","${ex.maxWeightKg}","${growth >= 0 ? `+${growth}` : growth}","${ex.volume || 0}"`);
    });
  } else {
    lines.push(`"No exercise records logged yet","—","—","—","—"`);
  }
  lines.push("");

  // Workout History
  if (data.workoutLogs && data.workoutLogs.length > 0) {
    lines.push(`"RECENT WORKOUT SESSIONS"`);
    lines.push(`"Date","Routine / Day Label","Duration (mins)"`);
    data.workoutLogs.forEach((w) => {
      lines.push(`"${w.date}","${w.title}","${w.durationMinutes || "N/A"}"`);
    });
  }

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `${data.clientName.replace(/\s+/g, "_")}_Progress_Report_${new Date().toISOString().split("T")[0]}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate and print / download formatted PDF progress report
 */
export function exportClientProgressPdf(data: ClientProgressExportData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups to download the PDF progress report.");
    return;
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const weightDelta =
    data.currentWeight != null && data.initialWeight != null
      ? (data.currentWeight - data.initialWeight).toFixed(1)
      : null;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Client Progress Report — ${data.clientName}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .report-badge {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .meta-text {
      font-size: 11px;
      color: #64748b;
      text-align: right;
    }
    .client-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .client-item-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .client-item-val {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      text-align: center;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
    }
    .kpi-sub {
      font-size: 10px;
      font-weight: 600;
      margin-top: 2px;
    }
    .text-emerald { color: #059669; }
    .text-amber { color: #d97706; }
    .text-rose { color: #e11d48; }
    .text-indigo { color: #4f46e5; }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 10px;
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 16px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      text-align: left;
      padding: 8px 10px;
      font-weight: 700;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .footer {
      margin-top: 30px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; display: flex; gap: 8px; justify-content: flex-end;">
    <button onclick="window.print()" style="background: #0f172a; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <div class="brand-title">${data.gymName || "Client Progress Report"}</div>
      <div class="report-badge">Official Client Progress Summary</div>
    </div>
    <div class="meta-text">
      <div><strong>Report Date:</strong> ${dateStr}</div>
      <div><strong>Trainer:</strong> ${data.trainerName || "Assigned Trainer"}</div>
      ${data.gymName ? `<div><strong>Gym:</strong> ${data.gymName}</div>` : ""}
    </div>
  </div>

  <div class="client-card">
    <div>
      <div class="client-item-label">Client Name</div>
      <div class="client-item-val">${data.clientName}</div>
    </div>
    <div>
      <div class="client-item-label">Contact Phone</div>
      <div class="client-item-val">${data.clientPhone || "—"}</div>
    </div>
    <div>
      <div class="client-item-label">Membership Plan</div>
      <div class="client-item-val">${data.membershipPlan || "Active Plan"}</div>
    </div>
    <div>
      <div class="client-item-label">Active Routine</div>
      <div class="client-item-val">${data.planTitle || "Custom Routine"}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="client-item-label">Current Weight</div>
      <div class="kpi-val">${data.currentWeight != null ? `${data.currentWeight} kg` : "—"}</div>
      <div class="kpi-sub ${Number(weightDelta) <= 0 ? "text-emerald" : "text-amber"}">
        ${weightDelta != null ? `${Number(weightDelta) >= 0 ? "+" : ""}${weightDelta} kg overall` : "No logs"}
      </div>
    </div>
    <div class="kpi-box">
      <div class="client-item-label">Body Mass Index (BMI)</div>
      <div class="kpi-val text-indigo">${data.bmiScore ?? "—"}</div>
      <div class="kpi-sub text-indigo font-bold">${data.bmiCategory || "Normal"}</div>
    </div>
    <div class="kpi-box">
      <div class="client-item-label">Workout Completion</div>
      <div class="kpi-val text-emerald">${data.completionRatePercent ?? 0}%</div>
      <div class="kpi-sub text-slate-500">${data.totalWorkoutSessions ?? 0} sessions logged</div>
    </div>
    <div class="kpi-box">
      <div class="client-item-label">Target Goal Weight</div>
      <div class="kpi-val">${data.targetWeight != null ? `${data.targetWeight} kg` : "—"}</div>
      <div class="kpi-sub text-emerald">
        ${data.currentWeight && data.targetWeight ? `${Math.abs(Number((data.currentWeight - data.targetWeight).toFixed(1)))} kg to goal` : "Goal set"}
      </div>
    </div>
  </div>

  <div class="section-title">Strength & Personal Records (PR) Progression</div>
  <table>
    <thead>
      <tr>
        <th>Exercise Name</th>
        <th style="text-align: right;">Initial Weight</th>
        <th style="text-align: right;">Current Max (PR)</th>
        <th style="text-align: right;">Net Growth</th>
        <th style="text-align: right;">Training Volume</th>
      </tr>
    </thead>
    <tbody>
      ${
        data.exerciseStats && data.exerciseStats.length > 0
          ? data.exerciseStats
              .map((ex) => {
                const init = ex.initialWeightKg || ex.maxWeightKg;
                const diff = Number((ex.maxWeightKg - init).toFixed(1));
                return `
              <tr>
                <td><strong>${ex.name}</strong></td>
                <td style="text-align: right;">${init} kg</td>
                <td style="text-align: right;"><strong>${ex.maxWeightKg} kg</strong></td>
                <td style="text-align: right;" class="${diff >= 0 ? "text-emerald" : "text-rose"}">
                  <strong>${diff >= 0 ? `+${diff}` : diff} kg</strong>
                </td>
                <td style="text-align: right;">${ex.volume ? `${ex.volume.toLocaleString()} kg` : "—"}</td>
              </tr>
            `;
              })
              .join("")
          : `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No strength logs logged yet.</td></tr>`
      }
    </tbody>
  </table>

  <div class="section-title">Weight & Body Composition Tracking Logs</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Logged Weight</th>
        <th>Height</th>
        <th>Calculated BMI</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${
        data.weightHistory && data.weightHistory.length > 0
          ? data.weightHistory
              .slice(0, 10)
              .map((w) => {
                const h = w.heightCm || data.heightCm;
                const bmi = h && w.weightKg ? (w.weightKg / Math.pow(h / 100, 2)).toFixed(1) : "—";
                return `
              <tr>
                <td>${w.date}</td>
                <td><strong>${w.weightKg} kg</strong></td>
                <td>${h ? `${h} cm` : "—"}</td>
                <td>${bmi}</td>
                <td><span style="color: #059669; font-weight: bold;">Logged</span></td>
              </tr>
            `;
              })
              .join("")
          : `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No weigh-in logs available.</td></tr>`
      }
    </tbody>
  </table>

  <div class="footer">
    <div>Confidential Fitness Record · Generated by Trainer: ${data.trainerName || "Staff"}</div>
    <div>Page 1 of 1</div>
  </div>

  <script>
    window.onload = function() {
      // Auto-trigger print dialog for instant save as PDF
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
