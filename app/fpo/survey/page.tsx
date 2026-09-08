import { FpoIdentity } from "@/components/fpo/FpoIdentity";
import { FpoSurvey } from "@/components/fpo/FpoSurvey";

export default function FpoSurveyPage() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <FpoIdentity>
        <FpoSurvey />
      </FpoIdentity>
    </div>
  );
}