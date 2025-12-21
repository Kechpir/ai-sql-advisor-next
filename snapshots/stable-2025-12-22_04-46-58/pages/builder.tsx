import dynamic from "next/dynamic";

const SqlBuilderApp = dynamic(() => import("@/components/SqlBuilderPanel/SqlBuilderApp"), {
  ssr: false,
});

export default function BuilderPage() {
  return <SqlBuilderApp />;
}
