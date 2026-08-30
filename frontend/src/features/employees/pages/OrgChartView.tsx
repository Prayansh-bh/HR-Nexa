import React from "react";
import { OrgChartView as LegacyOrgChartView } from "../components/OrgChartView";

export const OrgChartView: React.FC<any> = (props) => {
  return <LegacyOrgChartView {...props} />;
};
