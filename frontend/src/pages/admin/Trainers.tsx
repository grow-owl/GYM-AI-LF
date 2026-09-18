import { useState, useEffect } from "react";
import { gymApi } from "@/lib/endpoints";
import CustomSelect from "@/components/ui/CustomSelect";
import OwnerTrainers from "@/pages/owner/Trainers";
import { Loader2 } from "lucide-react";
import { showApiErrorToast } from "@/lib/api";

export default function Trainers() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loadingGyms, setLoadingGyms] = useState(true);

  useEffect(() => {
    const fetchGyms = async () => {
      setLoadingGyms(true);
      try {
        const res = await gymApi.listAllGyms();
        const gymList = res.gyms || [];
        setGyms(gymList);
        if (gymList.length > 0) {
          const gId = gymList[0]._id || gymList[0].id;
          setSelectedGymId(gId);
          if (gymList[0].branches?.length > 0) {
            setSelectedBranchId(gymList[0].branches[0]._id || gymList[0].branches[0].id);
          }
        }
      } catch (err: any) {
        showApiErrorToast(err, "Failed to load gym locations");
      } finally {
        setLoadingGyms(false);
      }
    };
    fetchGyms();
  }, []);

  const currentGym = gyms.find((g) => (g._id || g.id) === selectedGymId);
  const branchOptions = (currentGym?.branches || []).map((b: any) => ({
    value: b._id || b.id,
    label: b.name,
  }));

  const gymOptions = gyms.map((g: any) => ({
    value: g._id || g.id,
    label: g.name,
  }));

  if (loadingGyms) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-(--color-text-muted) gap-2">
        <Loader2 className="animate-spin text-(--color-accent)" size={20} /> Loading gym tenant directory...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Super Admin Tenant Selector Bar */}
      <div className="p-4 rounded-2xl border border-(--color-border) bg-(--color-surface) flex flex-wrap items-center gap-4 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-(--color-accent)">Super Admin Scope:</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-(--color-text-muted)">Gym:</span>
          <CustomSelect
            compact
            value={selectedGymId}
            onChange={(gId) => {
              setSelectedGymId(gId);
              const gymObj = gyms.find((g) => (g._id || g.id) === gId);
              if (gymObj?.branches?.length) {
                setSelectedBranchId(gymObj.branches[0]._id || gymObj.branches[0].id);
              } else {
                setSelectedBranchId("");
              }
            }}
            options={gymOptions}
          />
        </div>
        {branchOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--color-text-muted)">Branch:</span>
            <CustomSelect
              compact
              value={selectedBranchId}
              onChange={(bId) => setSelectedBranchId(bId)}
              options={branchOptions}
            />
          </div>
        )}
      </div>

      <OwnerTrainers overrideGymId={selectedGymId} overrideBranchId={selectedBranchId} backTo="/admin" />
    </div>
  );
}
