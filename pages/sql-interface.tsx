import SqlBuilderPanel from "../components/SqlBuilderPanel";
import DataTable from "../components/DataTable";

export default function SqlInterfacePage() {
  return (
    <div className="sql-interface-page">
      <SqlBuilderPanel />
      <DataTable />
    </div>
  );
}
