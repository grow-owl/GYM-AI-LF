import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Save, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { useFormValidation } from "@/lib/useFormValidation";
import { paymentApi } from "@/lib/endpoints";
import { showApiErrorToast } from "@/lib/api";
import { toast } from "sonner";

const defaultAdminSettings = {
  supportEmail: "support@gymai-saas.com",
  defaultTrialDays: 14,
  platformCurrency: "INR",
  maintenanceMode: false,
};

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { values, errors, touched, handleChange, handleBlur, validateAll, setValues } = useFormValidation(
    defaultAdminSettings,
    {
      supportEmail: { required: "Support email is required", email: "Enter a valid email" },
      defaultTrialDays: { required: "Trial period days is required" },
    }
  );

  useEffect(() => {
    let mounted = true;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await paymentApi.getPlatformSettings();
        if (mounted && res?.settings) {
          setValues({
            supportEmail: res.settings.supportEmail || defaultAdminSettings.supportEmail,
            defaultTrialDays: res.settings.defaultTrialDays ?? defaultAdminSettings.defaultTrialDays,
            platformCurrency: res.settings.platformCurrency || defaultAdminSettings.platformCurrency,
            maintenanceMode: Boolean(res.settings.maintenanceMode),
          });
        }
      } catch (err: any) {
        showApiErrorToast(err, "Failed to load platform settings from server");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    setSaving(true);
    const updated = {
      supportEmail: values.supportEmail,
      defaultTrialDays: Number(values.defaultTrialDays),
      platformCurrency: values.platformCurrency,
      maintenanceMode: values.maintenanceMode,
    };

    try {
      const res = await paymentApi.updatePlatformSettings(updated);
      if (res?.settings) {
        setValues({
          supportEmail: res.settings.supportEmail,
          defaultTrialDays: res.settings.defaultTrialDays,
          platformCurrency: res.settings.platformCurrency,
          maintenanceMode: res.settings.maintenanceMode,
        });
      }
      toast.success("SaaS Platform settings saved to database!");
      setToastMessage("SaaS Platform settings updated successfully!");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      showApiErrorToast(err, "Failed to save platform settings to server");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 text-(--color-text-muted)">
        <Loader2 className="h-6 w-6 animate-spin text-(--color-accent)" />
        <p className="text-sm">Loading SaaS platform configuration...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text) flex items-center gap-2">
          <SettingsIcon className="text-(--color-accent)" size={26} /> SaaS Platform Control & Settings
        </h1>
        <p className="text-sm text-(--color-text-muted)">
          Global environment parameters, system maintenance flags, and trial configurations for Gym AI SaaS.
        </p>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="p-6 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-(--color-text)">Global SaaS Platform Parameters</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-(--color-text-muted) mb-1">
                Platform Support Email
              </label>
              <input
                type="email"
                value={values.supportEmail}
                onChange={(e) => handleChange("supportEmail", e.target.value)}
                onBlur={() => handleBlur("supportEmail")}
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                  touched.supportEmail && errors.supportEmail ? "border-rose-500" : "border-(--color-border)"
                }`}
              />
              {touched.supportEmail && errors.supportEmail && (
                <p className="text-xs text-rose-400 mt-1">{errors.supportEmail}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-(--color-text-muted) mb-1">
                Default Trial Period (Days)
              </label>
              <input
                type="number"
                value={values.defaultTrialDays}
                onChange={(e) => handleChange("defaultTrialDays", e.target.value)}
                onBlur={() => handleBlur("defaultTrialDays")}
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                  touched.defaultTrialDays && errors.defaultTrialDays ? "border-rose-500" : "border-(--color-border)"
                }`}
              />
              {touched.defaultTrialDays && errors.defaultTrialDays && (
                <p className="text-xs text-rose-400 mt-1">{errors.defaultTrialDays}</p>
              )}
            </div>
          </div>
        </div>

        {/* Feature Switches */}
        <div className="p-6 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-(--color-text)">System Flags & Maintenance</h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-rose-400 flex items-center gap-1.5">
                <ShieldAlert size={16} /> Platform Maintenance Mode
              </p>
              <p className="text-xs text-(--color-text-muted)">
                Temporarily restrict tenant access for scheduled core database maintenance.
              </p>
            </div>
            <input
              type="checkbox"
              checked={values.maintenanceMode}
              onChange={(e) => handleChange("maintenanceMode", e.target.checked)}
              className="h-5 w-5 rounded accent-rose-500 cursor-pointer"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-(--color-accent) text-white font-semibold text-sm rounded-xl hover:bg-(--color-accent-strong) shadow-lg shadow-(--color-accent-soft) transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
          {saving ? "Saving to Database..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
