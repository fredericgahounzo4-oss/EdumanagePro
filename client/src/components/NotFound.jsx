import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { usePrefs } from "../PrefsContext";
import { EmptyState } from "./ui";

export default function NotFound() {
  const { t } = usePrefs();
  return (
    <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
      <EmptyState icon={Compass} title={t("common.pageNotFound")} text={t("common.pageNotFoundText")}
        action={<Link to="/" className="btn btn-primary">{t("common.backHome")}</Link>} />
    </div>
  );
}
