import TailoredResume from "@/components/tailored-resume";

// Reads the id from the URL at request time; a small page, so blocking render is fine.
export const instant = false;

export default async function Page({ params }: PageProps<"/tailor/[id]">) {
  const { id } = await params;
  return <TailoredResume id={id} />;
}
