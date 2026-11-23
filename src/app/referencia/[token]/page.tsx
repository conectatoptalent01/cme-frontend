import ReferenceClient from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Confirmar referencia laboral · CME",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ReferenceClient token={token} />;
}
