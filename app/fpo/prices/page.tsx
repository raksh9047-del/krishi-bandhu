import { FpoIdentity } from "@/components/fpo/FpoIdentity";
import { FpoPriceEntry } from "@/components/fpo/FpoPriceEntry";

export default function FpoPricesPage() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <FpoIdentity>
        <FpoPriceEntry />
      </FpoIdentity>
    </div>
  );
}