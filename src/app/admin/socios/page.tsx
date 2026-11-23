import PartnerApplicationsAdmin from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitudes de Socio Reclutador · Admin CME", robots: { index: false } };

export default function Page() {
  return <PartnerApplicationsAdmin />;
}
