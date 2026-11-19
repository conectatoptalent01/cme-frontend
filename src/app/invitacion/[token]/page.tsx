import InvitationClient from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Te recomendaron para una vacante · CME",
  robots: { index: false, follow: false },
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationClient token={token} />;
}
