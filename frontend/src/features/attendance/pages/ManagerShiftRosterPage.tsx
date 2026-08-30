import React from "react";
import { ManagerShiftRosterPage as LegacyManagerShiftRosterPage } from "../../leave/pages/ManagerShiftRosterPage";

export const ManagerShiftRosterPage: React.FC<any> = (props) => {
  return <LegacyManagerShiftRosterPage {...props} />;
};
