import { FpoIdentity } from "@/components/fpo/FpoIdentity";
import { EpoEntryPanel } from "@/components/fpo/EpoEntryPanel";

export default function FpoEpoPage() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <FpoIdentity>
        <EpoEntryPanel />
      </FpoIdentity>
    </div>
  );
}