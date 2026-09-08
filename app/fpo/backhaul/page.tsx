import { FpoIdentity } from "@/components/fpo/FpoIdentity";
import { FpoBackhaulAdmin } from "@/components/fpo/FpoBackhaulAdmin";

export default function FpoBackhaulPage() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <FpoIdentity>
        <FpoBackhaulAdmin />
      </FpoIdentity>
    </div>
  );
}